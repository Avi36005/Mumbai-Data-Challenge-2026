"""AirPulse cloud updater: runs in GitHub Actions twice a day, with no laptop and no Zindi files.

1. Download the newest NOAA GFS runs (00Z / 12Z, 1 degree, forecast hours 6-81) from the public NOAA Open Data bucket on AWS and read
   the six weather fields at the four official stations (bilinear), exactly as tools/gfs_weather.py does for the competition.
2. Weather engine (cloud/wx_lgbm.txt, trained by airpulse_city/wx_engine.py): PM2.5 for every hour; the newest run wins per hour.
3. Spread to 22 more stations (cloud/transfer.json: ridge transfer + distance weighting, validated) and to the 24 BMC wards.
4. Write site/data/city.json: the fixed part (measured week + submitted 11-12 Nov forecast, cloud/base_city.json) plus every complete
   new forecast day, and site/data/status.json for the "How it works" panel.
Usage: python cloud/cloud_update.py [--offline TABLE.csv.gz]   (offline: read a local GFS station table instead of downloading)
"""
import http.client,json,sys,time
from datetime import datetime,timedelta,timezone
from pathlib import Path
import numpy as np,pandas as pd
R = Path(__file__).resolve().parents[1];C = R/'cloud';IST = 'Asia/Kolkata'
STN = {'11606':(19.23241,72.86895),'11611':(19.19709,72.82204),'3409510':(18.9767,72.838),'3409511':(19.060498,72.923356)}
FIELDS = [('UGRD','10 m above ground'),('VGRD','10 m above ground'),('TMP','2 m above ground'),('RH','2 m above ground'),('PRATE','surface'),('HPBL','surface')]
GRIB_CODES = {'UGRD':(0,2,2,103,10),'VGRD':(0,2,3,103,10),'TMP':(0,0,0,103,2),'RH':(0,1,1,103,2),'PRATE':(0,1,7,1,0),'HPBL':(0,3,196,1,0)}
STEPS = list(range(6,82,3));HOST = 'noaa-gfs-bdp-pds.s3.amazonaws.com';UA = 'airpulse-mumbai/1.0 (NOAA GFS NODD open data)'
ORDER = ['11606','11611','3409510','3409511']
FEAT = ['TMP','RH','UGRD','VGRD','WS','HPBL','VENT','RAIN','vent6','vent24','rain12','rain24','hpbl_min12','lead','hour','weekday','doy_s','doy_c']+['st_'+s for s in ORDER]

# ---------- 1. NOAA GFS ----------
_conn = None
def get(path,rng=None,tries=5):
    global _conn
    for k in range(tries):
        try:
            if _conn is None:_conn = http.client.HTTPSConnection(HOST,timeout=60)
            _conn.request('GET',path,headers={'User-Agent':UA,**({'Range':f'bytes={rng[0]}-{rng[1]}'} if rng else {})});r = _conn.getresponse();b = r.read()
            if r.status==404:return None
            if r.status not in (200,206):raise OSError(f'HTTP {r.status} {path}')
            return b
        except OSError:
            if _conn:_conn.close()
            _conn = None
            if k==tries-1:raise
            time.sleep(2**k)
key = lambda c,s:f"/gfs.{c:%Y%m%d}/{c:%H}/atmos/gfs.t{c:%H}z.pgrb2.1p00.f{s:03d}"
def decode(msg,cycle,step,var):
    import eccodes
    g = eccodes.codes_new_from_message(msg)
    try:
        assert (eccodes.codes_get(g,'dataDate'),eccodes.codes_get(g,'dataTime'))==(int(f'{cycle:%Y%m%d}'),cycle.hour*100) and eccodes.codes_get(g,'forecastTime')==step
        assert tuple(eccodes.codes_get_long(g,k) for k in ['discipline','parameterCategory','parameterNumber','typeOfFirstFixedSurface','level'])==GRIB_CODES[var]
        ni,nj = eccodes.codes_get(g,'Ni'),eccodes.codes_get(g,'Nj');lat0,lon0 = eccodes.codes_get(g,'latitudeOfFirstGridPointInDegrees'),eccodes.codes_get(g,'longitudeOfFirstGridPointInDegrees')
        dlat,dlon = eccodes.codes_get(g,'jDirectionIncrementInDegrees'),eccodes.codes_get(g,'iDirectionIncrementInDegrees');grid = eccodes.codes_get_values(g).reshape(nj,ni)
    finally:eccodes.codes_release(g)
    out = []
    for sid,(la,lo) in STN.items():
        y,x = (lat0-la)/dlat,(lo-lon0)/dlon;j,i = int(np.floor(y)),int(np.floor(x));fy,fx = y-j,x-i
        out.append((sid,var,float(grid[j,i]*(1-fy)*(1-fx)+grid[j,i+1]*(1-fy)*fx+grid[j+1,i]*fy*(1-fx)+grid[j+1,i+1]*fy*fx)))
    return out
def fetch_cycle(c):
    rows = []
    for s in STEPS:
        idx = get(key(c,s)+'.idx')
        if idx is None:return None
        lines = [l.split(':') for l in idx.decode().strip().splitlines()]
        for n,l in enumerate(lines):
            if (l[3],l[4]) in FIELDS and l[5]==f'{s} hour fcst':
                end = int(lines[n+1][1])-1;body = get(key(c,s),(int(l[1]),end))
                for sid,var,v in decode(body,c,s,l[3]):rows.append({'cycle':c.isoformat(),'step':s,'location_id':sid,'variable':var,'value':v})
    return pd.DataFrame(rows)
def newest_runs(n=2):
    now = datetime.now(timezone.utc);c = now.replace(hour=12 if now.hour>=12 else 0,minute=0,second=0,microsecond=0);got = []
    for _ in range(8):
        if len(got)==n:break
        if get(key(c,81)+'.idx') is not None:
            t = fetch_cycle(c)
            if t is not None and len(t)==len(STEPS)*6*4:got.append(t);print('GFS run',c.isoformat(),'rows',len(t),flush=True)
        c -= timedelta(hours=12)
    assert got,'no complete GFS run found';return pd.concat(got,ignore_index=True)

# ---------- 2. weather engine (same features as airpulse_city/wx_engine.py) ----------
def weather_rows(w):
    w = w[w.location_id.isin(ORDER)].pivot_table(index=['cycle','location_id','step'],columns='variable',values='value').reset_index();w['cycle'] = pd.to_datetime(w.cycle,utc=True);out = []
    for (c,l),g in w.groupby(['cycle','location_id'],sort=False):
        g = g.set_index('step').sort_index()[['HPBL','PRATE','RH','TMP','UGRD','VGRD']].astype(float)
        if len(g)<20:continue
        hrs = np.arange(g.index.min()+.5,g.index.max(),1.0);x = g.reindex(g.index.union(hrs)).interpolate(method='index',limit_area='inside').loc[hrs]
        x['lead'] = hrs;x['cycle'] = c;x['location_id'] = l;out.append(x.reset_index(drop=True))
    x = pd.concat(out,ignore_index=True);x['WS'] = np.hypot(x.UGRD,x.VGRD);x['VENT'] = x.WS*x.HPBL;x['RAIN'] = x.PRATE*3600;x['TMP'] = x.TMP-273.15
    x = x.sort_values(['cycle','location_id','lead']);g = x.groupby(['cycle','location_id'],sort=False)
    for k,col,n,f in (('vent6','VENT',6,'mean'),('vent24','VENT',24,'mean'),('rain12','RAIN',12,'sum'),('rain24','RAIN',24,'sum'),('hpbl_min12','HPBL',12,'min')):
        x[k] = g[col].transform(lambda s:getattr(s.rolling(n,min_periods=max(3,n//2)),f)())
    x['vt'] = (x.cycle+pd.to_timedelta(x.lead,unit='h')).dt.tz_convert(IST);x['hour'] = x.vt.dt.hour;x['weekday'] = x.vt.dt.weekday
    doy = x.vt.dt.dayofyear;x['doy_s'] = np.sin(2*np.pi*doy/365.25);x['doy_c'] = np.cos(2*np.pi*doy/365.25)
    for s in ORDER:x['st_'+s] = (x.location_id==s).astype(float)
    return x

# ---------- 3. stations and wards ----------
def km(a,b,c,d):return float(np.hypot((a-c)*111.0,(b-d)*111.0*np.cos(np.radians(19.07))))
def idw(vals,pos,la,lo):w = np.array([1/max(.3,km(la,lo,*q))**2 for q in pos]);return (vals*w).sum(axis=-1)/w.sum()
def spread(pt,base,tr):
    """pt: DataFrame (hours x 4 target stations, columns in tr['target_order']). Returns per-station and per-ward hourly arrays."""
    x = np.log1p(pt[tr['target_order']].to_numpy());h = pt.index.hour.to_numpy()
    X = np.column_stack([x,x.mean(axis=1),np.sin(2*np.pi*h/24),np.cos(2*np.pi*h/24),np.sin(4*np.pi*h/24),np.cos(4*np.pi*h/24)])
    st = {k:pt[k].to_numpy() for k in tr['target_order']}
    for s in tr['stations']:st[s['name']] = .5*np.expm1(X@np.array(s['coef'])+s['intercept'])+.5*idw(pt[tr['target_order']].to_numpy(),tr['target_pos'],s['lat'],s['lon'])
    names = [s['name'] for s in base['stations']];name_of = {k:v for k,v in zip(tr['target_order'],names[:4])}
    S = np.array([st[k] for k in tr['target_order']]+[st[n] for n in names[4:]]).T;pos = [(s['lat'],s['lon']) for s in base['stations']]
    return {names[i]:S[:,i] for i in range(len(names))},{w['id']:idw(S,pos,w['lat'],w['lon']) for w in base['wards']}

def main():
    t0 = time.time();started = datetime.now(timezone.utc)
    if '--offline' in sys.argv:w = pd.read_csv(sys.argv[sys.argv.index('--offline')+1],dtype={'location_id':str});w['cycle'] = pd.to_datetime(w.cycle,utc=True);w = w[w.cycle>=w.cycle.max()-pd.Timedelta(hours=12)];w['cycle'] = w.cycle.map(lambda c:c.isoformat())
    else:w = newest_runs()
    import lightgbm
    bst = lightgbm.Booster(model_file=str(C/'wx_lgbm.txt'));x = weather_rows(w);newest = x.cycle.max()
    x = x.sort_values('cycle').drop_duplicates(['location_id','vt'],keep='last');x = x[x.lead>=6].assign(p=lambda q:np.expm1(bst.predict(q[FEAT])))
    new = x[['vt','location_id','p','cycle','lead']].assign(built=datetime.now(timezone.utc).astimezone().strftime('%Y-%m-%d %H:%M'))
    sf = C/'store.csv'
    if sf.exists():
        old = pd.read_csv(sf,dtype={'location_id':str});old['vt'] = pd.to_datetime(old.vt).dt.tz_convert(IST);old['cycle'] = pd.to_datetime(old.cycle,utc=True)
        new = pd.concat([old,new]).sort_values('cycle').drop_duplicates(['location_id','vt'],keep='last')
    new.sort_values(['vt','location_id']).to_csv(sf,index=False)
    base = json.loads((C/'base_city.json').read_text());tr = json.loads((C/'transfer.json').read_text())
    end = pd.Timestamp(base['hours'][-1]+':00',tz=IST);new['day'] = new.vt.dt.date;days = []
    for day,g in new[new.vt>end].groupby('day'):
        if g.vt.nunique()==24 and g.location_id.nunique()==4:days.append(day)
        else:break
    city = json.loads(json.dumps(base));wins = list(base.get('windows',[]))
    if days:
        sel = new[new.day.isin(days)];pt = sel.pivot_table(index='vt',columns='location_id',values='p').sort_index()
        full = pd.date_range(end+pd.Timedelta(hours=1),periods=24*len(days),freq='h');assert len(pt)==len(full) and (pt.index==full).all(),'engine days must follow the fixed part'
        st,wd = spread(pt,base,tr);r1 = lambda a:[round(float(v),1) for v in a]
        city['hours'] = base['hours']+[t.strftime('%Y-%m-%dT%H:%M') for t in pt.index];city['kind'] = base['kind']+'f'*len(pt)
        for s in city['stations']:s['base'] = s['base']+r1(st[s['name']]);s['hi'] = s['hi']+r1(st[s['name']])
        for w_ in city['wards']:w_['base'] = w_['base']+r1(wd[w_['id']]);w_['hi'] = w_['hi']+r1(wd[w_['id']])
        for d in days:
            g = sel[sel.day==d];wins.append({'days':[str(d)],'note':'daily weather engine','gfs_run':str(pd.to_datetime(g.cycle,utc=True).max())[:16]+'Z','built':str(g.built.max())})
    city['windows'] = wins;city['generated'] = datetime.now(timezone.utc).astimezone(timezone(timedelta(hours=5,minutes=30))).strftime('%Y-%m-%d %H:%M IST')
    (R/'site/data/city.json').write_text(json.dumps(city,separators=(',',':')))
    status = {'updated':city['generated'],'runner':'GitHub Actions (cloud)' if '--offline' not in sys.argv else 'local check','gfs_run':str(newest)[:16].replace(' ','T')+'Z',
              'forecast_to':city['hours'][-1],'days':len(city['hours'])//24,'engine_days':[str(d) for d in days],'seconds':round(time.time()-t0)}
    (R/'site/data/status.json').write_text(json.dumps(status,indent=1));print(json.dumps(status))

if __name__=='__main__':main()
