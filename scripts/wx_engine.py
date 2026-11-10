"""AirPulse daily engine: PM2.5 for the four official stations from the NOAA GFS forecast alone (no recent PM needed), so the app can
forecast any day after the last Zindi release. Inputs: Zindi Train.csv (labels) and the GFS station tables (ClimateVerse catalogue source).

Rows: every GFS run (00Z, 12Z) x station x forecast hour 6..81, the run's variables interpolated to each hour; label = the station's
PM2.5 for the hour starting at that valid time. Features: weather at the hour, ventilation / rain over the previous 6, 12, 24 h of the
same run, lead, hour of day (IST), weekday, day of year, station. Target log1p(PM). Diwali days (LP-3 .. LP+4) are not used as labels.

  wx_engine.py validate   -> out-of-time test: train on runs before 1 Sep 2026, score day-ahead leads (18-66 h) on 1 Sep - 5 Nov 2026
  wx_engine.py train      -> fit on everything, save model to airpulse_city/models/wx_lgbm.txt
  wx_engine.py forecast TABLE    -> hourly forecast for the 4 stations from the newest GFS runs in TABLE; merged into
                                    airpulse_city/store/wx_forecasts.csv (for every hour the newest run wins)
"""
import json,sys
from pathlib import Path
import numpy as np,pandas as pd
H = Path(__file__).resolve().parent;P = H.parent;CM = P/'competition_model';sys.path.insert(0,str(CM));import src.solution as S
IST = 'Asia/Kolkata';PKG = P/'Google_Mumbai_Data_Challenge_FINAL_2026-11-10';STN = ['11606','11611','3409510','3409511']
LP = [pd.Timestamp(x,tz=IST) for x in ('2025-10-21','2026-11-08')]
PARAMS = dict(objective='regression',n_estimators=600,learning_rate=.03,num_leaves=31,min_child_samples=200,subsample=.8,subsample_freq=1,colsample_bytree=.8,reg_lambda=5,random_state=7,deterministic=True,force_row_wise=True,n_jobs=3,verbose=-1)
FEAT = ['TMP','RH','UGRD','VGRD','WS','HPBL','VENT','RAIN','vent6','vent24','rain12','rain24','hpbl_min12','lead','hour','weekday','doy_s','doy_c']+['st_'+s for s in STN]

def weather_rows(table):
    w = pd.read_csv(table,dtype={'location_id':str});w = w[w.location_id.isin(STN)]
    w = w.pivot_table(index=['cycle','location_id','step'],columns='variable',values='value').reset_index();w['cycle'] = pd.to_datetime(w.cycle,utc=True)
    out = []
    for (c,l),g in w.groupby(['cycle','location_id'],sort=False):
        g = g.set_index('step').sort_index()[['HPBL','PRATE','RH','TMP','UGRD','VGRD']].astype(float)
        if len(g)<20:continue
        hrs = np.arange(g.index.min()+.5,g.index.max(),1.0)   # GFS cycles are 00/12 UTC = 05:30/17:30 IST, so whole IST hours sit at half-hour leads
        x = g.reindex(g.index.union(hrs)).interpolate(method='index',limit_area='inside').loc[hrs];x['lead'] = hrs;x['cycle'] = c;x['location_id'] = l;out.append(x.reset_index(drop=True))
    x = pd.concat(out,ignore_index=True);x['WS'] = np.hypot(x.UGRD,x.VGRD);x['VENT'] = x.WS*x.HPBL;x['RAIN'] = x.PRATE*3600;x['TMP'] = x.TMP-273.15
    x = x.sort_values(['cycle','location_id','lead']);g = x.groupby(['cycle','location_id'],sort=False)
    for k,col,n,f in (('vent6','VENT',6,'mean'),('vent24','VENT',24,'mean'),('rain12','RAIN',12,'sum'),('rain24','RAIN',24,'sum'),('hpbl_min12','HPBL',12,'min')):
        x[k] = g[col].transform(lambda s:getattr(s.rolling(n,min_periods=max(3,n//2)),f)())
    x['vt'] = (x.cycle+pd.to_timedelta(x.lead,unit='h')).dt.tz_convert(IST);x['hour'] = x.vt.dt.hour;x['weekday'] = x.vt.dt.weekday
    doy = x.vt.dt.dayofyear;x['doy_s'] = np.sin(2*np.pi*doy/365.25);x['doy_c'] = np.cos(2*np.pi*doy/365.25)
    for s in STN:x['st_'+s] = (x.location_id==s).astype(float)
    return x

def labels():
    tr,*_ = S.load_release(str(PKG));tr['location_id'] = tr.location_id.astype(str);tr = tr[tr.pm25.between(0,1000)]
    y = tr.assign(vt=(pd.to_datetime(tr.hour_end)-pd.Timedelta(hours=1)).dt.tz_convert(IST)).groupby(['location_id','vt']).pm25.mean().rename('y').reset_index()
    fest = np.zeros(len(y),bool)
    for lp in LP:fest |= ((y.vt>=lp-pd.Timedelta(days=3))&(y.vt<lp+pd.Timedelta(days=5))).to_numpy()
    return y[~fest]

def frame():
    x = weather_rows(CM/'external/gfs/refreshed_final/station_values_ext_verified.csv.gz')
    return x.merge(labels(),on=['location_id','vt'],how='inner'),x

def fit(d):
    import lightgbm
    return lightgbm.LGBMRegressor(**PARAMS).fit(d[FEAT],np.log1p(d.y))

rm = lambda a,b:float(np.sqrt(np.mean((np.asarray(a)-np.asarray(b))**2)))
if __name__=='__main__':
    mode = sys.argv[1]
    if mode=='validate':
        d,_ = frame();cut = pd.Timestamp('2026-09-01',tz='UTC');tr = d[d.cycle+pd.to_timedelta(d.lead,unit='h')<cut];te = d[(d.vt>=cut.tz_convert(IST))&(d.vt<pd.Timestamp('2026-11-05',tz=IST))&d.lead.between(18,66)]
        m = fit(tr);te = te.assign(p=np.expm1(m.predict(te[FEAT])))
        # Baselines without weather: (a) station x hour mean of the 60 days before the test period; (b) station x hour x month mean over all training data
        hist = tr.drop_duplicates(['location_id','vt']);rec = hist[hist.vt>=cut.tz_convert(IST)-pd.Timedelta(days=60)].groupby(['location_id','hour']).y.mean().rename('b60')
        te = te.join(rec,on=['location_id','hour']);hist = hist.assign(mon=hist.vt.dt.month);te = te.assign(mon=te.vt.dt.month).join(hist.groupby(['location_id','mon','hour']).y.mean().rename('bclim'),on=['location_id','mon','hour'])
        u = te.dropna(subset=['b60','bclim']);daily = u.assign(day=u.vt.dt.date).groupby(['location_id','day'])[['y','p','b60']].mean()
        res = {'rows':len(u),'stations':4,'test':'1 Sep - 5 Nov 2026, leads 18-66 h, Diwali excluded','rmse_model':round(rm(u.p,u.y),2),'rmse_recent60':round(rm(u.b60,u.y),2),'rmse_clim':round(rm(u.bclim,u.y),2),
               'bias_model':round(float((u.p-u.y).mean()),2),'daily_rmse_model':round(rm(daily.p,daily.y),2),'daily_rmse_recent60':round(rm(daily.b60,daily.y),2),
               'daily_corr_model':round(float(np.corrcoef(daily.p,daily.y)[0,1]),3),'daily_corr_recent60':round(float(np.corrcoef(daily.b60,daily.y)[0,1]),3),'by_station':{s:round(rm(g.p,g.y),2) for s,g in u.groupby('location_id')}}
        res['gain_vs_recent60_pct'] = round(100*(1-res['rmse_model']/res['rmse_recent60']),1);print(json.dumps(res,indent=1));(H/'models').mkdir(exist_ok=True);(H/'models/wx_validation.json').write_text(json.dumps(res,indent=1))
    elif mode=='forecast':
        import lightgbm
        table = Path(sys.argv[2]);bst = lightgbm.Booster(model_file=str(H/'models/wx_lgbm.txt'))
        x = weather_rows(table);newest = x.cycle.max();x = x[x.cycle>=newest-pd.Timedelta(hours=36)]
        x = x.sort_values('cycle').drop_duplicates(['location_id','vt'],keep='last')       # newest run for each hour
        x = x[x.lead>=6].assign(p=lambda q:np.expm1(bst.predict(q[FEAT])))
        new = x[['vt','location_id','p','cycle','lead']].assign(built=pd.Timestamp.now(tz=IST).strftime('%Y-%m-%d %H:%M'))
        st = H/'store/wx_forecasts.csv';st.parent.mkdir(exist_ok=True)
        if st.exists():
            old = pd.read_csv(st,dtype={'location_id':str});old['vt'] = pd.to_datetime(old.vt).dt.tz_convert(IST);old['cycle'] = pd.to_datetime(old.cycle,utc=True)
            new = pd.concat([old,new]).sort_values('cycle').drop_duplicates(['location_id','vt'],keep='last')
        new.sort_values(['vt','location_id']).to_csv(st,index=False)
        print('newest GFS run',newest,'| store hours',new.vt.nunique(),'from',new.vt.min(),'to',new.vt.max())
    elif mode=='train':
        d,_ = frame();m = fit(d);(H/'models').mkdir(exist_ok=True);m.booster_.save_model(str(H/'models/wx_lgbm.txt'))
        print('trained on',len(d),'rows, runs',d.cycle.nunique(),'from',d.vt.min(),'to',d.vt.max())
