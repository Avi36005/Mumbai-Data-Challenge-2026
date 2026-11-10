"""Mumbai AirPulse data export. Reads ONLY existing project artefacts (official Zindi package, GFS station tables, stored backtest
predictions, final/rehearsal build folders) and writes airpulse/data/*.json for the static dashboard. Fits nothing.
Usage (from the project root): competition_model/.venv-model/bin/python airpulse/build_data.py [--package DIR] [--forecast-dir OUTD]"""
import argparse,glob,json,sys
from pathlib import Path
import numpy as np,pandas as pd
P = Path(__file__).resolve().parents[1];CM = P/'competition_model';E = CM/'experiments';sys.path.insert(0,str(CM));sys.path.insert(0,str(E/'diwali_2026-11-06'))
import src.solution as S
IST = 'Asia/Kolkata';OUT = P/'airpulse/data';OUT.mkdir(parents=True,exist_ok=True)
ap = argparse.ArgumentParser();ap.add_argument('--package',default=str(P/'Google_Mumbai_Data_Challenge_FINAL_2026-11-10'));ap.add_argument('--forecast-dir',default=str(P/'FINAL_UPLOAD_11-12Nov'));a = ap.parse_args()
SHORT = {'11611':'Malad West','3409511':'Shivaji Nagar','11606':'Borivali East','3409510':'Byculla'}
r1 = lambda x,n=1:None if x is None or not np.isfinite(x) else round(float(x),n)
def dump(name,obj):(OUT/f'{name}.json').write_text(json.dumps(obj,separators=(',',':'),default=str));print('wrote',name)
train,test,sample,stations,_ = S.load_release(a.package);train['location_id'] = train.location_id.astype(str)
st = pd.read_csv(Path(a.package)/'data/Stations.csv',dtype=str)
dump('stations',[{'id':r.location_id,'name':r.station_name,'short':SHORT[r.location_id],'operator':r.station_name.split('- ')[-1],'lat':float(r.latitude),'lon':float(r.longitude)} for r in st.itertuples()])
Y = train.assign(hs=pd.to_datetime(train.hour_end,utc=True)-pd.Timedelta(hours=1)).set_index(['location_id','hs']).pm25
# ---- history: daily means for the whole span + hourly for the last 45 days ----
t = train.assign(he=pd.to_datetime(train.hour_end).dt.tz_convert(IST));t = t[t.pm25<=1000]
daily = t.assign(d=(t.he-pd.Timedelta(hours=1)).dt.strftime('%Y-%m-%d')).groupby(['location_id','d']).pm25.agg(['mean','count']).reset_index()
end = t.he.max();rec = t[t.he>end-pd.Timedelta(days=45)]
dump('history',{'latest':str(end),'daily':{l:[[r.d,r1(r['mean']),int(r['count'])] for _,r in g.iterrows()] for l,g in daily.groupby('location_id')},
                'hourly':{l:[[x.he.strftime('%Y-%m-%dT%H:%M'),r1(x.pm25)] for x in g.itertuples()] for l,g in rec.groupby('location_id')}})
# ---- data health (computed from Train, raw rows) ----
raw = train.assign(he=pd.to_datetime(train.hour_end).dt.tz_convert(IST));health = {}
for l,g in raw.groupby('location_id'):
    g = g.sort_values('he');span = pd.date_range(g.he.min(),g.he.max(),freq='h');have = set(g.he);miss = [h not in have for h in span]
    runs,cur = [],0
    for m in miss:
        if m:cur += 1
        elif cur:runs.append(cur);cur = 0
    v = g.pm25.to_numpy();stuck = 0;k = 1
    for i in range(1,len(v)):
        k = k+1 if v[i]==v[i-1] else 1
        if k==6:stuck += 1
    mon = g.assign(m=g.he.dt.strftime('%Y-%m')).groupby('m').size()
    exp = pd.Series(1,index=span).groupby(span.strftime('%Y-%m')).size()
    health[l] = {'first':str(g.he.min()),'last':str(g.he.max()),'hours':len(g),'coverage':r1(100*len(g)/len(span)),'longest_gap_h':max(runs) if runs else 0,'gaps_over_24h':sum(r>24 for r in runs),
                 'over_1000':int((g.pm25>1000).sum()),'max':r1(g.pm25.max()),'stuck_runs_6h':stuck,'monthly_coverage':{m:r1(100*mon.get(m,0)/exp[m]) for m in exp.index}}
dump('health',health)
# ---- what the model actually knows (release-day information view; same rules as final_build.py) ----
Sx = pd.Timestamp('2026-11-11',tz=IST);F0 = pd.Timestamp('2026-11-06',tz=IST);tr = train[train.hour_end<=Sx];last = tr.groupby('location_id').hour_end.max();L = last.max();C = L.ceil('12h')
if (C-last).max()>pd.Timedelta(hours=6):C = L.floor('12h')
if C.hour==12:C = C-pd.Timedelta(hours=12)
g = int((Sx-C)/pd.Timedelta(hours=1))
if 0<g<24:C = Sx-pd.Timedelta(hours=24);g = 24
know = {'target_start':str(Sx),'origin':str(C),'gap_h':g,'festival_start':str(F0),'mode':'clip125','stations':{}}
for l,x in tr.groupby('location_id'):
    ref = x[(x.hour_end>F0-pd.Timedelta(days=28))&(x.hour_end<=F0)&(x.pm25<=1000)].pm25.mean();cap = 1.25*ref
    used = x[x.hour_end<=C];fest = x[(x.hour_end>F0)&(x.hour_end<=C)];after = x[x.hour_end>C]
    know['stations'][l] = {'latest':str(x.hour_end.max()),'newest_kept':str(used.hour_end.max()),'stale_h':float((Sx-used.hour_end.max())/pd.Timedelta(hours=1)),'cap':r1(cap),
        'fest_hours':len(fest),'capped':int((fest.pm25>cap).sum()),'fest_median':r1(fest.pm25.median()),'fest_max':r1(fest.pm25.max()),'dropped_after_origin':len(after),
        'after_origin_mean':r1(after.pm25.mean()),'pre_week_median':r1(x[(x.hour_end>F0-pd.Timedelta(days=7))&(x.hour_end<=F0)].pm25.median())}
dump('knows',know)
# ---- skill lab: stored backtests (28 windows; masked routes = festival geometry) ----
dates = [w for w in (E/'anchor_support_2026-11-06/dates.txt').read_text().split() if w!='2026-01-12']
rm = lambda p,y:float(np.sqrt(np.mean((np.asarray(p)-np.asarray(y))**2)))
routes = {'G24':(24,96),'G48':(48,72),'G96':(96,24),'G120':(120,0)};skill = {'routes':{},'note':'28 historical windows, the festival-mask geometry; labels <= 1000; rule = level + 28-day hourly profile baseline from the same inputs'}
for name,(gg,M) in routes.items():
    rows = [];per = []
    for w in dates:
        f = E/f'festival_cutoff_2026-11-06/out/r_{gg}_{M}_{w}.csv.gz'
        if not f.exists():continue
        d = pd.read_csv(f,dtype={'location_id':str});d['hs'] = pd.to_datetime(d.hour_start,utc=True);d['y'] = Y.reindex(pd.MultiIndex.from_arrays([d.location_id,d.hs])).to_numpy()
        d = d[d.y.notna()&(d.y<=1000)];d['inc'] = .5*d.anchor400+.5*d.gap
        if not len(d):continue
        per.append({'S':w,'model':r1(rm(d.inc,d.y),2),'rule':r1(rm(d.rule,d.y),2),'pair':r1(min(rm(.85*d.inc,d.y),rm(1.15*d.inc,d.y)),2),'actual_mean':r1(d.y.mean())});rows.append(d)
    if not rows:continue
    a_ = pd.concat(rows);skill['routes'][name] = {'gap_h':gg,'hole_h':M,'windows':len(per),'rows':len(a_),'model':r1(rm(a_.inc,a_.y),2),'rule':r1(rm(a_.rule,a_.y),2),
        'pair_mean':r1(float(np.mean([p['pair'] for p in per])),2),'model_mean':r1(float(np.mean([p['model'] for p in per])),2),'rule_mean':r1(float(np.mean([p['rule'] for p in per])),2),'wins_vs_rule':int(sum(p['model']<p['rule'] for p in per)),'pair_wins_vs_model':int(sum(p['pair']<p['model'] for p in per)),'bias':r1((a_.inc-a_.y).mean()),'per_window':per}
# unseen 5-6 Nov (forecast built 7 Nov before the labels existed)
R = E/'ready_2026-11-04/out_REHEARSAL_NOT_FOR_UPLOAD_2026-11-07_2323';te = test.copy();te['location_id'] = te.location_id.astype(str);te['hs'] = pd.to_datetime(te.hour_start,utc=True)
w = te[(te.hour_start>=pd.Timestamp('2026-11-05',tz=IST))&(te.hour_start<pd.Timestamp('2026-11-07',tz=IST))].copy()
for k,f in (('base','FINAL_11-12Nov'),('lo','FINAL_11-12Nov_x0.85'),('hi','FINAL_11-12Nov_x1.15')):w[k] = pd.read_csv(R/f'{f}.csv').set_index('ID').Target.reindex(w.ID).to_numpy()
w['y'] = Y.reindex(pd.MultiIndex.from_arrays([w.location_id,w.hs])).to_numpy();ok = w[w.y.notna()&(w.y<=1000)]
skill['unseen'] = {'window':'5-6 Nov 2026','built':'7 Nov 23:23 IST, before labels','rmse':{k:r1(rm(ok[k],ok.y),2) for k in ('base','lo','hi')},'bias':{k:r1((ok[k]-ok.y).mean()) for k in ('base','lo','hi')},
    'hourly':{l:[[x.hour_start.strftime('%Y-%m-%dT%H:%M'),r1(x.base),r1(x.lo),r1(x.hi),r1(x.y) if x.y==x.y and x.y<=1000 else None] for x in g.sort_values('hs').itertuples()] for l,g in w.groupby('location_id')}}
dw = {'lgbm':{},'baseline':json.loads((E/'partc2_2026-11-10/side_results.json').read_text())}
for y_ in (2019,2024,2025):
    q = json.loads((E/f'partc2_2026-11-10/results_{y_}.json').read_text());dw['lgbm'][str(y_)] = {'actual_mean':q['actual_mean'],'base':q['O0-clipP']['single'],'flat115':q['O0-clipP']['x1.15'],'night':q['O0-clipP']['U'],'pair_flat':q['pair_A_runbook'],'pair_night':q['pair_R'],'rows':q['rows']}
skill['diwali'] = dw
dump('skill',skill)
# ---- festival lens: Diwali 2019 / 2024 / 2025 / 2026 (daily means relative to Lakshmi Puja) ----
import diwali as DW
aux,_,names = DW.series();LP = {'2019':pd.Timestamp('2019-10-27',tz=IST),'2024':pd.Timestamp('2024-11-01',tz=IST),'2025':pd.Timestamp('2025-10-21',tz=IST),'2026':pd.Timestamp('2026-11-08',tz=IST)}
fest = {}
def curve(df,ids,lp):
    d = df[df.location_id.isin(ids)&(df.hour_start>=lp-10*pd.Timedelta(days=1))&(df.hour_start<lp+7*pd.Timedelta(days=1))].copy();d = d[d.pm25<=1000]
    d['k'] = ((d.hour_start-lp)/pd.Timedelta(days=1)).apply(np.floor).astype(int);c = d.groupby('k').pm25.agg(['mean','count'])
    h = d[(d.hour_start>=lp-2*pd.Timedelta(days=1))&(d.hour_start<lp+3*pd.Timedelta(days=1))].groupby('hour_start').pm25.mean()
    return {'daily':[[int(k),r1(r['mean']),int(r['count'])] for k,r in c.iterrows()],'peak_hour':[str(h.idxmax()),r1(h.max())] if len(h) else None}
for y_,pre in (('2019','kaggle:'),('2024','xkdr:')):
    ids = DW.pick(aux,LP[y_],pre,names);fest[y_] = {'lp':str(LP[y_].date()),'series':len(ids),'source':'Zindi AdditionalHistory ('+('Kaggle 2018-20' if y_=='2019' else 'XKDR 2024')+')',**curve(aux,ids,LP[y_])}
tt = train.assign(hour_start=pd.to_datetime(train.hour_end)-pd.Timedelta(hours=1))[['location_id','hour_start','pm25']]
for y_ in ('2025','2026'):fest[y_] = {'lp':str(LP[y_].date()),'series':4,'source':'Zindi Train (4 challenge stations)'+(' - 7-8 Nov held back by Zindi' if y_=='2026' else ''),**curve(tt,list(SHORT),LP[y_])}
sys.path.insert(0,str(E/'final_uplift_2026-11-10'));import build_uplift as BU
sets_,names_ = BU.series(a.package);ny = {}
for y_,pre in ((2019,'kaggle:'),(2024,'xkdr:')):
    c_ = BU.year_curve(sets_[y_],BU.pick(sets_[y_],BU.LP[y_],pre,names_),BU.LP[y_]);ny[str(y_)] = [r1(c_.get((d_,h_)),2) for d_ in (3,4) for h_ in range(24)]
u_,_ = BU.curve(a.package);fest['night'] = {'years':ny,'used':[r1(u_[(d_,h_)],3) for d_ in (3,4) for h_ in range(24)],'note':'ratio of PM2.5 at each clock hour, 3 and 4 days after Lakshmi Puja, to the same hour in the week before (median over stations)'}
t26 = tt.assign(location_id=tt.location_id.astype(str));t26['h'] = t26.hour_start.dt.hour;pre26 = t26[(t26.hour_start>=LP['2026']-9*pd.Timedelta(days=1))&(t26.hour_start<LP['2026']-2*pd.Timedelta(days=1))].groupby(['location_id','h']).pm25.mean().rename('pre')
o26 = t26[(t26.hour_start>=LP['2026']+pd.Timedelta(days=1))&(t26.pm25<=1000)].join(pre26,on=['location_id','h']);o26['r'] = o26.pm25/o26.pre;o26['k'] = ((o26.hour_start-LP['2026'])/pd.Timedelta(hours=1)).astype(int)
fest['night']['observed_2026'] = [[int(k),r1(v,2)] for k,v in o26.groupby('k').r.median().items()]
dump('festival',fest)
# ---- weather drivers: newest GFS run in the final weather table ----
wt = pd.read_csv(CM/'external/gfs/refreshed_final/station_values_ext_verified.csv.gz',dtype={'location_id':str});wt['cycle'] = pd.to_datetime(wt.cycle,utc=True);cyc = wt.cycle.max()
x = wt[wt.cycle==cyc].pivot_table(index=['location_id','valid_time'],columns='variable',values='value').reset_index();x['vt'] = pd.to_datetime(x.valid_time,utc=True).dt.tz_convert(IST)
x['ws'] = np.hypot(x.UGRD,x.VGRD);x['wdir'] = (270-np.degrees(np.arctan2(x.VGRD,x.UGRD)))%360;x['vent'] = x.ws*x.HPBL;x['rain'] = x.PRATE*3600;x['t'] = x.TMP-273.15
dump('weather',{'cycle':str(cyc),'source':'NOAA GFS 1-degree via NODD (ClimateVerse catalogue)','stations':{l:[[r.vt.strftime('%Y-%m-%dT%H:%M'),r1(r.ws),r1(r.wdir,0),r1(r.HPBL,0),r1(r.vent,0),r1(r.rain,2),r1(r.t),r1(r.RH,0)] for r in g.sort_values('vt').itertuples()] for l,g in x.groupby('location_id')},
     'columns':['time','wind_ms','wind_dir','mixing_height_m','ventilation_m2s','rain_mmh','temp_c','rh_pct']})
# ---- forecast for 11-12 Nov (the final or the latest real-data rehearsal build) ----
fd = Path(a.forecast_dir);fc = {'status':'pending','note':'final files not found'}
if (fd/'FINAL_11-12Nov_CLIP125.csv').exists():
    import hashlib
    bd = sorted(glob.glob(str(E/'ready_2026-11-04/out_final_2026-11-10_*/FINAL_11-12Nov_CLIP125.manifest.json')))[-1];m = json.loads(Path(bd).read_text());w = te[(te.hour_start>=Sx)&(te.hour_start<Sx+pd.Timedelta(days=2))].copy()
    F_ = {'base':'FINAL_11-12Nov_CLIP125.csv','hi':'FINAL_11-12Nov_CLIP125_NIGHTUPLIFT.csv'};assert hashlib.sha256((fd/F_['base']).read_bytes()).hexdigest()==m['sha256']
    for k,f in F_.items():w[k] = pd.read_csv(fd/f).set_index('ID').Target.reindex(w.ID).to_numpy()
    w['lo'] = w.base
    fc = {'status':'built','folder':fd.name,'origin':m['nominal_origin'],'gap_h':m['gap_hours'],'recipe':m['recipe'],'festival_rule':m['festival_rule_applied'],'festival_mode':m.get('festival_mode'),'issue':m['issue'],
          'files':{k:{'name':f,'sha256':hashlib.sha256((fd/f).read_bytes()).hexdigest()[:16]} for k,f in F_.items()},
          'weather_cycles':[f['weather_cycle'] for f in m['fits']],'hourly':{l:[[x.hour_start.strftime('%Y-%m-%dT%H:%M'),r1(x.base),r1(x.lo),r1(x.hi)] for x in g.sort_values('hour_start').itertuples()] for l,g in w.groupby('location_id')}}
dump('forecast',fc)
dump('meta',{'generated':pd.Timestamp.now(tz=IST).strftime('%Y-%m-%d %H:%M IST'),'package':Path(a.package).name,'train_rows':len(train),'forecast_status':fc['status']})
