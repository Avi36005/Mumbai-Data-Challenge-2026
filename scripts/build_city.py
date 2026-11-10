"""AirPulse city layer: spread the 4-station 11-12 Nov forecast over all of Mumbai and count who is exposed.

Inputs (all from the Zindi package or the ClimateVerse catalogue; nothing else):
  - Zindi package: Train.csv (4 forecast stations), AdditionalHistory (2024 XKDR series for ~25 Mumbai stations, Other_Mumbai_Stations Oct 2026, station coordinates)
  - the two submitted forecast files (FINAL_UPLOAD_11-12Nov)
  - BMC ward boundaries, BMC prabhag population (ClimateVerse records 2DGEEJ, EREDWQ), UDISE+ 2024-25 school data (XJIY8W) in raw/
Model ("spatial transfer"): for every other Mumbai station s, a ridge regression of log(1+PM_s) on log(1+PM) of the 4 forecast stations plus hour-of-day,
trained on the dry-season months of 2024 (Jan-Feb, Oct-Dec). Checked two ways before use: a time hold-out inside 2024, and a two-year jump to Oct 2026.
Wards: inverse-distance mean (power 2) of all station values at the ward centroid.
Usage (project root): competition_model/.venv-model/bin/python airpulse_city/build_city.py
"""
import csv,json,re,sys
from pathlib import Path
import numpy as np,pandas as pd
from sklearn.linear_model import Ridge
H = Path(__file__).resolve().parent;P = H.parent;PKG = P/'Google_Mumbai_Data_Challenge_FINAL_2026-11-10';OUT = H/'site/data';OUT.mkdir(parents=True,exist_ok=True)
sys.path.insert(0,str(P/'competition_model'));import src.solution as S
IST = 'Asia/Kolkata';r1 = lambda x,n=1:None if x is None or not np.isfinite(x) else round(float(x),n)
TARGET = {'11611':'Malad West','3409511':'Shivaji Nagar','11606':'Borivali East','3409510':'Byculla'}
T2024 = {'11611':['xkdr:site_5102','xkdr:site_5402'],'11606':['xkdr:site_5113','xkdr:site_5400'],'3409510':['xkdr:site_5960'],'3409511':['xkdr:site_5961']}
WARD_AREA = {'A':'Colaba · Fort','B':'Dongri · Masjid','C':'Kalbadevi · Marine Lines','D':'Grant Road · Malabar Hill','E':'Byculla · Mazgaon','F/NORTH':'Matunga · Sion','F/SOUTH':'Parel · Sewri',
    'G/NORTH':'Dadar · Dharavi','G/SOUTH':'Worli · Lower Parel','H/EAST':'Bandra East · Santacruz East','H/WEST':'Bandra West · Khar','K/EAST':'Andheri East · Jogeshwari East','K/WEST':'Andheri West · Juhu',
    'L':'Kurla','M/EAST':'Govandi · Mankhurd','M/WEST':'Chembur','N':'Ghatkopar · Vikhroli','P/NORTH':'Malad','P/SOUTH':'Goregaon','R/CENTRAL':'Borivali','R/NORTH':'Dahisar','R/SOUTH':'Kandivali','S':'Bhandup · Powai','T':'Mulund'}
rm = lambda e:float(np.sqrt(np.mean(np.square(e))))

# ---------- station series ----------
a = pd.read_csv(PKG/'additional_history/History_Mumbai_2024.csv.gz',usecols=['series_id','station_name','timestamp_ist','pm25_nonnegative'],low_memory=False)
a['t'] = pd.to_datetime(a.timestamp_ist).dt.tz_convert(IST).dt.floor('h');a = a[(a.pm25_nonnegative>=0)&(a.pm25_nonnegative<=1000)]
h24 = a.groupby(['series_id','t']).pm25_nonnegative.mean().unstack(0)
meta = pd.read_csv(PKG/'additional_history/XKDR_All_Stations.csv');meta['sid'] = 'xkdr:'+meta.station_id;meta = meta.set_index('sid')
tg = pd.DataFrame({k:h24[[c for c in v if c in h24]].mean(axis=1) for k,v in T2024.items()})  # the 4 forecast stations in 2024
tcols = [c for v in T2024.values() for c in v]
others = {}
for sid in h24.columns:
    if sid in tcols or sid not in meta.index or not np.isfinite(meta.loc[sid,'latitude']):continue
    nm = meta.loc[sid,'station_name'].split(', Mumbai')[0].replace(' Mumbai','').strip()
    if nm in others and h24[others[nm]].notna().sum()>=h24[sid].notna().sum():continue
    others[nm] = sid
print('other stations with coordinates in 2024:',len(others))
def design(tgt):
    x = np.log1p(tgt[list(TARGET)].to_numpy());hr = tgt.index.hour.to_numpy()
    return np.column_stack([x,x.mean(axis=1),np.sin(2*np.pi*hr/24),np.cos(2*np.pi*hr/24),np.sin(4*np.pi*hr/24),np.cos(4*np.pi*hr/24)])
dry = tg.index.month.isin([1,2,10,11,12]);full = tg.notna().all(axis=1)
km = lambda la1,lo1,la2,lo2:float(np.hypot((la1-la2)*111.0,(lo1-lo2)*111.0*np.cos(np.radians(19.07))))
tpos = pd.read_csv(PKG/'data/Stations.csv',dtype={'location_id':str}).set_index('location_id')[['latitude','longitude']]
def idw(vals,pos,la,lo,p=2):
    d = np.array([max(.3,km(la,lo,*q)) for q in pos]);w = 1/d**p;return (vals*w).sum(axis=-1)/w.sum()
models = {};val = []
split = pd.Timestamp('2024-11-16',tz=IST)
for nm,sid in sorted(others.items()):
    y = h24[sid].reindex(tg.index);ok = dry&full&y.notna()
    tr = ok&(tg.index<split);te = ok&(tg.index>=split)
    if tr.sum()<500:continue
    la,lo = float(meta.loc[sid,'latitude']),float(meta.loc[sid,'longitude'])
    row = {'station':nm,'lat':la,'lon':lo,'train_hours':int(ok.sum())}
    if te.sum()>=200:
        m = Ridge(alpha=3).fit(design(tg[tr]),np.log1p(y[tr]));p = np.expm1(m.predict(design(tg[te])));base = idw(tg[te][list(TARGET)].to_numpy(),[tuple(tpos.loc[k]) for k in TARGET],la,lo)
        bl = .5*p+.5*base;row.update(holdout_rmse_blend=r1(rm(bl-y[te]),1),holdout_hours=int(te.sum()),holdout_rmse=r1(rm(p-y[te]),1),holdout_rmse_idw=r1(rm(base-y[te]),1),holdout_mean=r1(y[te].mean(),1),holdout_corr=r1(np.corrcoef(p,y[te])[0,1],2))
    models[nm] = Ridge(alpha=3).fit(design(tg[ok]),np.log1p(y[ok]));val.append(row)
# ---------- two-year jump: 1-16 Oct 2026 ----------
train,test,_,_,_ = S.load_release(str(PKG));train['location_id'] = train.location_id.astype(str)
tr26 = train.assign(t=(pd.to_datetime(train.hour_end)-pd.Timedelta(hours=1)).dt.tz_convert(IST)).query('pm25<=1000').pivot_table(index='t',columns='location_id',values='pm25')[list(TARGET)]
o = pd.read_csv(PKG/'additional_history/Other_Mumbai_Stations_2025_2026.csv.gz');o['t'] = pd.to_datetime(o.timestamp_ist).dt.tz_convert(IST)-pd.Timedelta(hours=1)
o['nm'] = o.station_name.str.split(', Mumbai').str[0].str.strip();o26 = o[o.t>=pd.Timestamp('2026-10-01',tz=IST)].pivot_table(index='t',columns='nm',values='mean')
jump = []
for nm in o26.columns:
    if nm not in models:continue
    y = o26[nm];x = tr26.reindex(y.index);ok = x.notna().all(axis=1)&y.notna()
    if ok.sum()<60:continue
    p = np.expm1(models[nm].predict(design(x[ok])));v = next(r for r in val if r['station']==nm);base = idw(x[ok].to_numpy(),[tuple(tpos.loc[k]) for k in TARGET],v['lat'],v['lon'])
    v.update(oct26_rmse_blend=r1(rm(.5*p+.5*base-y[ok]),1),oct26_hours=int(ok.sum()),oct26_rmse=r1(rm(p-y[ok]),1),oct26_rmse_idw=r1(rm(base-y[ok]),1),oct26_mean=r1(y[ok].mean(),1),oct26_bias=r1((p-y[ok]).mean(),1));jump.append(nm)
V = pd.DataFrame(val);print(V.drop(columns=['lat','lon']).to_string(index=False))
hv = V.dropna(subset=['holdout_rmse']);jv = V.dropna(subset=['oct26_rmse']) if 'oct26_rmse' in V else V.iloc[:0]
summary = {'stations_modelled':len(models),'holdout':{'stations':len(hv),'hours':int(hv.holdout_hours.sum()),'rmse_model':r1(np.sqrt((hv.holdout_rmse**2*hv.holdout_hours).sum()/hv.holdout_hours.sum()),1),
    'rmse_blend':r1(np.sqrt((hv.holdout_rmse_blend**2*hv.holdout_hours).sum()/hv.holdout_hours.sum()),1),'rmse_idw':r1(np.sqrt((hv.holdout_rmse_idw**2*hv.holdout_hours).sum()/hv.holdout_hours.sum()),1),'mean':r1((hv.holdout_mean*hv.holdout_hours).sum()/hv.holdout_hours.sum(),1),'better':int((hv.holdout_rmse<hv.holdout_rmse_idw).sum())},
    'oct26':{'stations':len(jv),'hours':int(jv.oct26_hours.sum()) if len(jv) else 0,'rmse_model':r1(np.sqrt((jv.oct26_rmse**2*jv.oct26_hours).sum()/jv.oct26_hours.sum()),1) if len(jv) else None,
    'rmse_blend':r1(np.sqrt((jv.oct26_rmse_blend**2*jv.oct26_hours).sum()/jv.oct26_hours.sum()),1) if len(jv) else None,'rmse_idw':r1(np.sqrt((jv.oct26_rmse_idw**2*jv.oct26_hours).sum()/jv.oct26_hours.sum()),1) if len(jv) else None,'mean':r1((jv.oct26_mean*jv.oct26_hours).sum()/jv.oct26_hours.sum(),1) if len(jv) else None,
    'better':int((jv.oct26_rmse<jv.oct26_rmse_idw).sum()) if len(jv) else 0}}
print(json.dumps(summary))
# ---------- apply to the submitted 11-12 Nov forecast ----------
# Forecast windows: airpulse_city/windows.json lists 48-hour builds in the order they were made. The submitted 11-12 Nov pair comes first;
# each later daily build only ADDS days that no earlier window covers (the submitted competition forecast is never overwritten).
te = test.copy();te['location_id'] = te.location_id.astype(str);te['hour_start'] = te.hour_start.dt.tz_convert(IST)
WIN = json.loads((H/'windows.json').read_text()) if (H/'windows.json').exists() else [{'start':'2026-11-11','base':'FINAL_UPLOAD_11-12Nov/FINAL_11-12Nov_CLIP125.csv','hi':'FINAL_UPLOAD_11-12Nov/FINAL_11-12Nov_CLIP125_NIGHTUPLIFT.csv','built':'2026-11-10 12:46 IST','note':'submitted competition forecast'}]
parts = {'base':[],'hi':[]};covered = set();winfo = [];kind = {}
# Measured days: the last week of real readings (Zindi Train) before the forecast. Gaps (outages) and the hours after the last release hour
# are filled with the weather engine: the newest forecast run if available, else its day-before hindcast. Every hour is tagged m / f.
MEAS_FROM = pd.Timestamp('2026-11-04',tz=IST);FIRST_FC = pd.Timestamp(WIN[0]['start'],tz=IST)
obs = train.assign(hs=(pd.to_datetime(train.hour_end)-pd.Timedelta(hours=1)).dt.tz_convert(IST)).query('pm25<=1000').pivot_table(index='hs',columns='location_id',values='pm25')
idx = pd.date_range(MEAS_FROM,FIRST_FC-pd.Timedelta(hours=1),freq='h');obs = obs.reindex(idx)[list(TARGET)]
fill = pd.DataFrame(index=idx,columns=list(TARGET),dtype=float)
for fn in ('store/wx_hindcast.csv','store/wx_forecasts.csv'):   # later file wins
    if (H/fn).exists():
        q = pd.read_csv(H/fn,dtype={'location_id':str});q['vt'] = pd.to_datetime(q.vt).dt.tz_convert(IST);q = q.pivot_table(index='vt',columns='location_id',values='p').reindex(idx)[list(TARGET)]
        fill = q.combine_first(fill) if fn.endswith('forecasts.csv') else fill.combine_first(q)
meas = obs.combine_first(fill);assert meas.notna().all().all(),'measured days have unfilled hours'
for t_ in idx:kind[t_] = 'm' if obs.loc[t_].notna().sum()>=3 else 'f'
parts['base'].append(meas);parts['hi'].append(meas.copy());covered |= set(idx.date)
winfo.append({'days':sorted({str(d) for d in idx.date}),'note':'measured','built':'Zindi Train to '+str(train.hour_end.max())[:16],'filled_hours':int(obs.isna().any(axis=1).sum())})
for wdef in WIN:
    S0 = pd.Timestamp(wdef['start'],tz=IST);w = te[(te.hour_start>=S0)&(te.hour_start<S0+pd.Timedelta(days=2))].copy();assert len(w)==192,(wdef,len(w))
    for k in ('base','hi'):w[k] = pd.read_csv(P/wdef[k]).set_index('ID').Target.reindex(w.ID).to_numpy()
    days = [d for d in sorted(w.hour_start.dt.date.unique()) if d not in covered];w = w[w.hour_start.dt.date.isin(days)]
    if not len(w):continue
    for k in ('base','hi'):pt = w.pivot_table(index='hour_start',columns='location_id',values=k)[list(TARGET)];assert pt.notna().all().all();parts[k].append(pt)
    covered |= set(days);winfo.append({'days':[str(d) for d in days],'built':wdef.get('built'),'note':wdef.get('note',''),'gap_h':wdef.get('gap_h')})
# Later days: the daily weather engine (wx_engine.py), complete days only (24 h x 4 stations). No Diwali uplift after LP+4, so 'hi' = 'base'.
stf = H/'store/wx_forecasts.csv'
if stf.exists():
    st = pd.read_csv(stf,dtype={'location_id':str});st['vt'] = pd.to_datetime(st.vt).dt.tz_convert(IST);st['day'] = st.vt.dt.date
    first = min(covered) if covered else None
    for day,g in st.groupby('day'):
        if day in covered or (first and day<first) or g.vt.nunique()<24 or g.location_id.nunique()<4:continue
        pt = g.pivot_table(index='vt',columns='location_id',values='p')[list(TARGET)];pt.index.name = 'hour_start'
        if pt.isna().any().any() or len(pt)!=24:continue
        parts['base'].append(pt);parts['hi'].append(pt.copy());covered.add(day)
        winfo.append({'days':[str(day)],'built':str(g.built.max()),'note':'daily weather engine','gfs_run':str(pd.to_datetime(g.cycle,utc=True).max())[:16]+'Z'})
fc = {k:pd.concat(v).sort_index() for k,v in parts.items()}
days_all = sorted({t.date() for t in fc['base'].index});full = pd.date_range(pd.Timestamp(days_all[0],tz=IST),pd.Timestamp(days_all[-1],tz=IST)+pd.Timedelta(hours=23),freq='h')
assert fc['base'].index.is_monotonic_increasing and len(fc['base'])%24==0 and len(fc['base'])==len(full),'forecast days must be contiguous'
print('forecast days:',[x['days'] for x in winfo])
hours = [t.strftime('%Y-%m-%dT%H:%M') for t in fc['base'].index];kinds = ''.join(kind.get(t,'f') for t in fc['base'].index);stations = []
for k_,nm in TARGET.items():stations.append({'name':nm,'lat':float(tpos.loc[k_,'latitude']),'lon':float(tpos.loc[k_,'longitude']),'kind':'forecast','base':[r1(v) for v in fc['base'][k_]],'hi':[r1(v) for v in fc['hi'][k_]]})
for nm,m in models.items():
    v = next(r for r in val if r['station']==nm);tp = [tuple(tpos.loc[k]) for k in TARGET]
    est = {k:.5*np.expm1(m.predict(design(fc[k])))+.5*idw(fc[k].to_numpy(),tp,v['lat'],v['lon']) for k in ('base','hi')}  # 50/50 blend: the validated choice
    stations.append({'name':nm,'lat':v['lat'],'lon':v['lon'],'kind':'estimated','base':[r1(x) for x in est['base']],'hi':[r1(x) for x in est['hi']]})
# ---------- wards: geometry, people, schools ----------
def dp(pts,eps):  # Douglas-Peucker, iterative
    keep = np.zeros(len(pts),bool);keep[0] = keep[-1] = True;st = [(0,len(pts)-1)];A = np.asarray(pts)
    while st:
        i,j = st.pop()
        if j<=i+1:continue
        a_,b_ = A[i],A[j];seg = b_-a_;n = np.hypot(*seg);q = A[i+1:j]
        d = np.abs(seg[0]*(q[:,1]-a_[1])-seg[1]*(q[:,0]-a_[0]))/n if n>0 else np.hypot(q[:,0]-a_[0],q[:,1]-a_[1]);k = int(d.argmax())
        if d[k]>eps:keep[i+1+k] = True;st += [(i,i+1+k),(i+1+k,j)]
    return A[keep]
def centroid(ring):
    x,y = np.asarray(ring).T;c = x[:-1]*y[1:]-x[1:]*y[:-1];A_ = c.sum()/2;return float(((y[:-1]+y[1:])*c).sum()/(6*A_)),float(((x[:-1]+x[1:])*c).sum()/(6*A_))
pop = {}
for f in json.load(open(H/'raw/prabhag.geojson'))['features']:pop[f['properties']['WARD']] = pop.get(f['properties']['WARD'],0)+(f['properties']['POPULATION'] or 0)
prof = pd.read_csv(H/'raw/city_prof1.csv',dtype=str,encoding_errors='ignore');prof['ward'] = prof.lgd_ward_name.str.replace(r' - Ward.*','',regex=True).str.replace(' MCGM','').str.upper().str.replace('WEST','WEST').str.strip()
enr = pd.read_csv(H/'raw/city_enr1.csv',dtype=str);cls = [c for c in enr.columns if re.match(r'c(pp|\d+)_[bg]$',c)];e1 = enr[enr.item_group=='1'].copy();e1['n'] = e1[cls].astype(float).sum(axis=1)
prof = prof.merge(e1.groupby('pseudocode').n.sum().rename('students'),left_on='pseudocode',right_index=True,how='left');sch = prof.groupby('ward').agg(schools=('pseudocode','size'),students=('students','sum'))
spos = [(s['lat'],s['lon']) for s in stations];SB = np.array([s['base'] for s in stations]).T;SH = np.array([s['hi'] for s in stations]).T
wards = [];geo = {'type':'FeatureCollection','features':[]}
for f in json.load(open(H/'raw/wards.geojson'))['features']:
    nm,ab = f['properties']['WARD'],f['properties']['ABBREVIATION'];ring = f['geometry']['coordinates'][0];la,lo = centroid(ring);simp = dp(ring,.00035)
    key = ab[0] if ab.endswith('X') else ab
    wards.append({'id':ab,'ward':nm.title().replace('/',' / '),'area':WARD_AREA[nm],'lat':r1(la,4),'lon':r1(lo,4),'pop':int(pop.get(key,0)),'schools':int(sch.schools.get(nm,0)),'students':int(sch.students.get(nm,0)),
                  'base':[r1(v) for v in idw(SB,spos,la,lo)],'hi':[r1(v) for v in idw(SH,spos,la,lo)]})
    geo['features'].append({'type':'Feature','properties':{'id':ab},'geometry':{'type':'Polygon','coordinates':[[[round(float(x),5),round(float(y),5)] for x,y in simp]]}})
assert all(w_['pop']>0 for w_ in wards),[w_['id'] for w_ in wards if not w_['pop']]
print('wards',len(wards),'pop',sum(w_['pop'] for w_ in wards),'schools',sum(w_['schools'] for w_ in wards),'students',sum(w_['students'] for w_ in wards),'| geo points',sum(len(f['geometry']['coordinates'][0]) for f in geo['features']))
(OUT/'city.json').write_text(json.dumps({'hours':hours,'kind':kinds,'windows':winfo,'generated':pd.Timestamp.now(tz=IST).strftime('%Y-%m-%d %H:%M IST'),'wards':wards,'stations':stations,'validation':{'summary':summary,'wx':json.loads((H/'models/wx_validation.json').read_text()) if (H/'models/wx_validation.json').exists() else None,'stations':[{k:v for k,v in r.items()} for r in val]},
    'sources':{'population':'BMC prabhag boundaries with population (ClimateVerse doi:10.71646/EREDWQ); Census-based, total %d'%sum(w_['pop'] for w_ in wards),
               'schools':'UDISE+ 2024-25, district Mumbai II, %d schools with a ward recorded (ClimateVerse doi:10.71646/XJIY8W)'%len(prof),'wards':'BMC administrative ward boundaries (ClimateVerse doi:10.71646/2DGEEJ)',
               'stations':'Zindi challenge package: Train.csv, AdditionalHistory (XKDR 2024, other Mumbai stations Oct 2026)'}},separators=(',',':')))
(OUT/'wards.geo.json').write_text(json.dumps(geo,separators=(',',':')));print('wrote city.json',round((OUT/'city.json').stat().st_size/1e3),'KB, wards.geo.json',round((OUT/'wards.geo.json').stat().st_size/1e3),'KB')
