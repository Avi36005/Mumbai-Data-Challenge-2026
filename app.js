/* AirPulse Mumbai — citizen app. Data: data/city.json (ward and station forecasts for 11-12 Nov 2026) and data/wards.geo.json. */
(() => {
const $ = s => document.querySelector(s), $$ = s => [...document.querySelectorAll(s)];
const CUT = [30, 60, 90, 120, 250, Infinity];
const COL = ['#2f9e44', '#8fb339', '#e0a800', '#f08c00', '#e03131', '#a61e4d'];
const catI = v => CUT.findIndex(c => v <= c);
const colOf = v => COL[catI(v)];
const ico = n => `<svg class="ic" aria-hidden="true"><use href="#i-${n}"/></svg>`;
const ACTS = {
  walk:    { icon: 'walk', win: [[5, 10], [16, 22]], sens: false },
  run:     { icon: 'run', win: [[5, 10], [16, 22]], sens: false, hard: true },
  kids:    { icon: 'kids', win: [[7, 19]], sens: true },
  commute: { icon: 'train', win: [[7, 11], [17, 22]], sens: false },
  elder:   { icon: 'heart', win: [[7, 20]], sens: true },
  work:    { icon: 'work', win: [[8, 19]], sens: false, allDay: true }
};
let D, GEO, map, wardLayer, lang = 'en', S = { ward: 'GN', hour: 8, act: 'walk', day: 0 };
try { const s = JSON.parse(localStorage.getItem('airpulse-city') || '{}'); Object.assign(S, s); lang = s.lang || lang; } catch (e) {}
{ const q = new URLSearchParams(location.search); if (I18N[q.get('lang')]) lang = q.get('lang'); if (q.get('ward')) S.ward = q.get('ward').toUpperCase(); }
const save = () => { try { localStorage.setItem('airpulse-city', JSON.stringify({ ward: S.ward, act: S.act, lang })); } catch (e) {} };
const T = (k, vars) => { let s = k.split('.').reduce((o, p) => o && o[p], I18N[lang]); if (s == null) s = k.split('.').reduce((o, p) => o && o[p], I18N.en);
  if (vars && typeof s === 'string') Object.entries(vars).forEach(([a, b]) => s = s.replaceAll(`{${a}}`, b)); return s; };
const n0 = v => Math.round(v), n1 = v => (Math.round(v * 10) / 10).toFixed(1);
const hh = h => String(h).padStart(2, '0') + ':00';
const hourOf = i => +D.hours[i].slice(11, 13);
const todayIST = () => new Date(Date.now() + 5.5 * 3600e3).toISOString().slice(0, 10);
const dayLabel = i => { const s = D.hours[i], y = +s.slice(0, 4), m = +s.slice(5, 7), d = +s.slice(8, 10); const wd = new Date(Date.UTC(y, m - 1, d)).getUTCDay();
  return `${T('days')[wd]} ${d} ${T('months')[m - 1]}`; };
const dayTab = dd => { const iso = D.hours[dd * 24].slice(0, 10), t = todayIST(), tm = new Date(Date.parse(t) + 864e5).toISOString().slice(0, 10);
  return iso === t ? `${T('today')} · ${dayLabel(dd * 24).split(' ').slice(1).join(' ')}` : iso === tm ? `${T('tomorrow')} · ${dayLabel(dd * 24).split(' ').slice(1).join(' ')}` : dayLabel(dd * 24); };
const dayKind = dd => { const k = (D.kind || '').slice(dd * 24, dd * 24 + 24); return !k.includes('m') ? 'kForecast' : k.endsWith('ffff') && k.lastIndexOf('m') < 22 ? 'kToday' : 'kMeasured'; };
const dayInfo = dd => (D.windows || []).find(w => w.days.includes(D.hours[dd * 24].slice(0, 10))) || {};
const W = () => D.wards.find(w => w.id === S.ward);
const dayIdx = d => [...Array(24)].map((_, k) => d * 24 + k);
const NDAYS = () => D.hours.length / 24;

fetch('data/city.json').then(r => r.json()).then(c => { D = c; return fetch('data/wards.geo.json'); }).then(r => r.json()).then(g => { GEO = g; init(); })
  .catch(e => { $('main').insertAdjacentHTML('afterbegin', `<p class="card">Could not load data (${e}). Serve this folder over http.</p>`); });

function init() {
  if (!D.wards.some(w => w.id === S.ward)) S.ward = 'GN';
  const now = new Date(), idx = D.hours.findIndex(h => Math.abs(new Date(h + ':00+05:30') - now) < 1800e3), td = D.hours.findIndex(h => h.slice(0, 10) === todayIST());
  const qh = new URLSearchParams(location.search).get('hour');
  $('#hour').max = D.hours.length - 1;
  S.hour = qh != null && +qh >= 0 && +qh < D.hours.length ? +qh : idx >= 0 ? idx : td >= 0 ? td + 8 : D.hours.length > 48 ? D.hours.length - 48 + 8 : 8; S.day = Math.floor(S.hour / 24);
  $('#ward').innerHTML = D.wards.slice().sort((a, b) => a.area.localeCompare(b.area)).map(w => `<option value="${w.id}">${w.area} (${w.ward})</option>`).join('');
  $('#ward').onchange = e => { S.ward = e.target.value; save(); renderAll(); };
  $('#locate').onclick = locate;
  $('#hour').oninput = e => { S.hour = +e.target.value; S.day = Math.floor(S.hour / 24); renderHour(); };
  $('#play').onclick = play;
  $$('.langs button').forEach(b => b.onclick = () => { lang = b.dataset.lang; save(); applyLang(); renderAll(); });
  $('#shareBtn').onclick = () => shareCard(false); $('#dlBtn').onclick = () => shareCard(true);
  buildMap(); initMyDay(); applyLang(); renderAll(); let rt; addEventListener('resize', () => { clearTimeout(rt); rt = setTimeout(drawChart, 150); });
  $$('.listen').forEach(b => b.onclick = () => speak(b.dataset.say, b)); $('#bmcCsv').onclick = rankCsv;
}
function applyLang() {
  document.documentElement.lang = lang; $$('.langs button').forEach(b => b.setAttribute('aria-pressed', b.dataset.lang === lang));
  $$('[data-t]').forEach(el => el.textContent = T(el.dataset.t)); $('#sources').textContent = T('sources'); if (D) buildLegend();
}
function renderAll() { $('#ward').value = S.ward; renderDays(); renderHour(); renderActs(); renderTrust(); fillMyDaySelects(); renderMyDay(); }

/* ---------- now card ---------- */
function renderDays() {
  $('#days').innerHTML = [...Array(NDAYS())].map((_, d) => `<button role="tab" aria-selected="${S.day === d}" data-d="${d}"><span>${dayTab(d)}</span><small>${T(dayKind(d))}</small></button>`).join('');
  const sel = $('#days').querySelector('[aria-selected="true"]'), strip = $('#days'); if (sel) strip.scrollLeft = sel.offsetLeft - strip.clientWidth / 2 + sel.clientWidth / 2;
  $$('#days button').forEach(b => b.onclick = () => { const d = +b.dataset.d; S.hour = d * 24 + (S.hour % 24); S.day = d; renderHour(); });
}
function renderHour() {
  const w = W(), i = S.hour, v = w.base[i], hi = w.hi[i], c = catI(v);
  $('#hour').value = i; $('#hourLabel').textContent = `${dayLabel(i)}, ${hh(hourOf(i))}`;
  $('#kNowL').textContent = T('kNow', { t: hh(hourOf(i)) }) + ' · ' + T(isM(i) ? 'measured' : 'expected'); $('#nowVal').textContent = n0(v); $('#nowCat').textContent = T('cat')[c]; $('#nowCat').style.background = COL[c];
  $('#nowLinger').textContent = hi - v >= 3 ? T('linger', { v: `${n0(hi)} (${T('cat')[catI(hi)]})` }) : T('lingerSame');
  $$('#days button').forEach(b => b.setAttribute('aria-selected', +b.dataset.d === S.day));
  const di = dayIdx(S.day), mean = di.reduce((s, k) => s + w.base[k], 0) / 24;
  const worst = di.reduce((a, k) => w.hi[k] > w.hi[a] ? k : a, di[0]), best = di.reduce((a, k) => w.base[k] < w.base[a] ? k : a, di[0]);
  $('#dayAvg').textContent = n0(mean); $('#dayAvgCat').innerHTML = `<span class="band" style="background:${colOf(mean)}">${T('cat')[catI(mean)]}</span> µg/m³`;
  $('#cig').textContent = n1(mean / 22); $('#best').textContent = hh(hourOf(best)); $('#bestSub').textContent = `${n0(w.base[best])} µg/m³ · ${T('cat')[catI(w.base[best])]}`;
  $('#worst').textContent = hh(hourOf(worst)); $('#worstSub').textContent = `${T('upto', { v: n0(w.hi[worst]) })}`;
  $('#chartH').textContent = T('chartH', { w: w.area }); const inf = dayInfo(S.day);
  $('#srcTag').textContent = inf.note === 'daily weather engine' ? T('srcWx', { r: (inf.gfs_run || '').replace('T', ' ') }) : inf.note === 'measured' ? T(dayKind(S.day) === 'kToday' ? 'srcToday' : 'srcMeas') : T('srcComp');
  drawChart(); paintMap(); renderPlan(); drawCard(); if (S.lastDay !== S.day) { S.lastDay = S.day; renderMyDay(); renderRank(); }
}

/* ---------- hourly chart (plain SVG): a 3-day window around the selected day; measured hours dark, forecast orange ---------- */
const isM = k => (D.kind || '')[k] === 'm';
function drawChart() {
  const svg = $('#chart'), W_ = svg.clientWidth || 800, H_ = svg.clientHeight || 340, m = { l: 44, r: 92, t: 30, b: 42 }, w = W(), N = D.hours.length;
  const d0 = Math.max(0, Math.min(S.day - 1, NDAYS() - 3)), k0 = d0 * 24, k1 = Math.min(N - 1, k0 + 71), n = k1 - k0 + 1;
  const seg = w.hi.slice(k0, k1 + 1), iw = W_ - m.l - m.r, ih = H_ - m.t - m.b, top = Math.max(100, Math.min(300, Math.ceil(Math.max(...seg) * 1.12 / 20) * 20));
  const X = k => m.l + iw * (k - k0) / (n - 1), Y = v => m.t + ih * (1 - Math.min(v, top) / top);
  let g = '', lo = 0;
  CUT.forEach((c, j) => { const a = lo, b = Math.min(c, top); if (b > a) { g += `<rect x="${m.l}" y="${Y(b)}" width="${iw}" height="${Y(a) - Y(b)}" fill="${COL[j]}" opacity=".08"/>`;
    if (Y(a) - Y(b) > 14) g += `<text class="bandlab" x="${m.l + iw + 8}" y="${(Y(a) + Y(b)) / 2 + 4}" style="fill:${COL[j]}">${T('cat')[j]}</text>`; } lo = c; });
  for (let v = 0; v <= top; v += top > 160 ? 50 : 20) g += `<line x1="${m.l}" x2="${m.l + iw}" y1="${Y(v)}" y2="${Y(v)}" stroke="#e3e7ef"/><text x="${m.l - 8}" y="${Y(v) + 4}" text-anchor="end">${v}</text>`;
  for (let d = d0; d * 24 <= k1; d++) { const x0 = X(d * 24); g += `<line x1="${x0}" x2="${x0}" y1="${m.t}" y2="${m.t + ih + 34}" stroke="#cfd5e0"/><text class="day" x="${x0 + 6}" y="${m.t + ih + 36}">${dayTab(d)}</text>`;
    [6, 12, 18].forEach(h => { const k = d * 24 + h; if (k <= k1) g += `<text x="${X(k)}" y="${m.t + ih + 18}" text-anchor="middle">${hh(h)}</text>`; }); }
  const ks = [...Array(n)].map((_, j) => k0 + j), P = (arr, sel) => { let s = '', on = false; ks.forEach(k => { if (sel(k)) { s += `${on ? 'L' : 'M'}${X(k).toFixed(1)},${Y(arr[k]).toFixed(1)}`; on = true; } else on = false; }); return s; };
  const fk = k => !isM(k) || (k > k0 && !isM(k - 1)) || (k < k1 && !isM(k + 1)), diff = ks.some(k => w.hi[k] - w.base[k] > 1);
  if (diff) { const area = ks.map((k, j) => `${j ? 'L' : 'M'}${X(k).toFixed(1)},${Y(w.hi[k]).toFixed(1)}`).join('') + ks.slice().reverse().map(k => `L${X(k).toFixed(1)},${Y(w.base[k]).toFixed(1)}`).join('') + 'Z';
    g += `<path d="${area}" fill="#e03131" opacity=".10"/><path d="${P(w.hi, k => !isM(k))}" fill="none" stroke="#e03131" stroke-width="2" stroke-dasharray="6 4"/>`; }
  g += `<path d="${P(w.base, fk)}" fill="none" stroke="#e8590c" stroke-width="3"/><path d="${P(w.base, k => isM(k))}" fill="none" stroke="#0f172a" stroke-width="2.2"/>`;
  ks.filter(k => w.base[k] > top).forEach(k => g += `<circle cx="${X(k)}" cy="${m.t + 3}" r="2.5" fill="#a61e4d"/>`);
  const lastM = ks.filter(isM).pop(); if (lastM != null && lastM < k1) g += `<text x="${X(lastM) + 4}" y="${m.t + 14}" style="fill:#0f172a;font-weight:700">${T('lastReading')}</text><line x1="${X(lastM)}" x2="${X(lastM)}" y1="${m.t}" y2="${m.t + ih}" stroke="#0f172a" stroke-width="1"/>`;
  const i = Math.min(Math.max(S.hour, k0), k1); g += `<line x1="${X(i)}" x2="${X(i)}" y1="${m.t}" y2="${m.t + ih}" stroke="#0f172a" stroke-dasharray="3 3"/><circle cx="${X(i)}" cy="${Y(w.base[i])}" r="6" fill="${isM(i) ? '#0f172a' : '#e8590c'}" stroke="#fff" stroke-width="2.5"/>`;
  const lx = Math.min(Math.max(X(i), m.l + 50), m.l + iw - 50); g += `<rect x="${lx - 48}" y="${m.t - 26}" width="96" height="22" rx="6" fill="#0f172a"/><text x="${lx}" y="${m.t - 11}" text-anchor="middle" style="fill:#fff;font-weight:700">${hh(hourOf(i))} · ${n0(w.base[i])}</text>`;
  g += `<rect x="${m.l}" y="${m.t}" width="${iw}" height="${ih}" fill="transparent" id="chartHit"/>`;
  svg.setAttribute('viewBox', `0 0 ${W_} ${H_}`); svg.innerHTML = g;
  const pick = e => { const r = svg.getBoundingClientRect(), x = (e.clientX - r.left) * W_ / r.width; return Math.max(k0, Math.min(k1, k0 + Math.round((x - m.l) / iw * (n - 1)))); };
  const hit = $('#chartHit'); hit.onmousemove = e => { const k = pick(e); showTip(e, `<b>${dayLabel(k)}, ${hh(hourOf(k))}</b><br>${isM(k) ? T('measured') : T('expected')}: ${n0(w.base[k])} (${T('cat')[catI(w.base[k])]})${!isM(k) && w.hi[k] - w.base[k] > 1 ? `<br>${T('lingerShort')}: ${n0(w.hi[k])}` : ''}`); };
  hit.onmouseleave = hideTip; hit.onclick = e => { S.hour = pick(e); S.day = Math.floor(S.hour / 24); renderHour(); };
}
function buildLegend() { $('#chartLegend').innerHTML = `<span><i style="background:#0f172a"></i>${T('measured')}</span><span><i style="background:#e8590c"></i>${T('expected')}</span><span><i class="dash"></i>${T('lingerShort')}</span><span><i class="sq" style="background:#e03131;opacity:.25"></i>${T('range')}</span>`;
  $('#legend').innerHTML = COL.map((c, i) => `<span><i class="sq" style="background:${c}"></i>${T('cat')[i]}</span>`).join('') + `<span><i class="dot big"></i>${T('stF')}</span><span><i class="dot"></i>${T('stE')}</span>`; }
const tipEl = () => $('#tip');
function showTip(e, html) { const t = tipEl(); t.innerHTML = html; t.style.opacity = 1; t.style.left = Math.min(e.clientX + 14, innerWidth - 270) + 'px'; t.style.top = (e.clientY + 14) + 'px'; }
function hideTip() { tipEl().style.opacity = 0; }
let timer = null;
function play() { if (timer) { clearInterval(timer); timer = null; $('#play').innerHTML = ico('play'); return; }
  $('#play').innerHTML = ico('pause'); timer = setInterval(() => { S.hour = (S.hour + 1) % D.hours.length; S.day = Math.floor(S.hour / 24); renderHour(); }, 450); }

/* ---------- plan my day ---------- */
function renderActs() {
  $('#acts').innerHTML = Object.entries(ACTS).map(([k, a]) => `<button role="radio" aria-checked="${S.act === k}" data-a="${k}">${ico(a.icon)}<span>${T('acts.' + k)}</span></button>`).join('');
  $$('#acts button').forEach(b => b.onclick = () => { S.act = b.dataset.a; save(); renderActs(); renderPlan(); });
}
function advice(v, a) { const c = catI(v); if (c <= 1) return a.sens && c === 1 ? T('adv.ok') : T('adv.ok'); if (c === 2) return a.sens || a.hard ? T('adv.sens_mod') : T('adv.mod'); if (c === 3) return T('adv.poor'); return T('adv.vpoor'); }
function renderPlan() {
  const w = W(), a = ACTS[S.act], d = S.day, cand = a.win.flatMap(([s, e]) => [...Array(e - s)].map((_, k) => d * 24 + s + k));
  const best = cand.reduce((x, k) => w.base[k] < w.base[x] ? k : x, cand[0]), worst = cand.reduce((x, k) => w.hi[k] > w.hi[x] ? k : x, cand[0]);
  const lo = Math.min(...cand.map(k => w.base[k])), hi_ = Math.max(...cand.map(k => w.base[k])), H_ = v => 18 + 82 * (v - lo) / Math.max(1, hi_ - lo);
  const bar = cand.map(k => `<i style="background:${colOf(w.base[k])};height:${H_(w.base[k])}%" class="${k === best ? 'best' : k === worst ? 'worst' : ''}" title="${hh(hourOf(k))}: ${n0(w.base[k])}"><b>${k === best || k === worst ? n0(w.base[k]) : ''}</b><em>${hourOf(k) % 3 === 0 ? hh(hourOf(k)) : ''}</em></i>`).join('');
  if (a.allDay) { const m = cand.reduce((s, k) => s + w.base[k], 0) / cand.length;
    $('#answer').innerHTML = `<div class="ans-main"><p class="eyebrow">${dayLabel(d * 24)} · ${w.area}</p><h3>${T('workNote', { v: n0(m), c: T('cat')[catI(m)], t: hh(hourOf(worst)) })}</h3><p>${advice(w.hi[worst], a)}</p></div><div class="bars">${bar}</div>`; return; }
  $('#answer').innerHTML = `<div class="ans-main"><p class="eyebrow">${dayLabel(d * 24)} · ${w.area} · ${T('acts.' + S.act)}</p>
    <h3>${T('go', { t: hh(hourOf(best)) })} <span class="band" style="background:${colOf(w.base[best])}">${T('cat')[catI(w.base[best])]} · ${n0(w.base[best])}</span></h3>
    <p class="avoid">${T('avoid')}: <b>${hh(hourOf(worst))}</b> · ${T('upto', { v: n0(w.hi[worst]) })}</p><p>${advice(w.base[best], a)}</p></div><div class="bars" aria-hidden="true">${bar}</div>`;
}

/* ---------- city map ---------- */
function buildMap() {
  map = L.map('map', { scrollWheelZoom: false, zoomSnap: .25, attributionControl: true }).setView([19.07, 72.87], 11);
  L.tileLayer('https://server.arcgisonline.com/ArcGIS/rest/services/Canvas/World_Light_Gray_Base/MapServer/tile/{z}/{y}/{x}', { attribution: 'Tiles © Esri', maxZoom: 16 }).addTo(map);
  wardLayer = L.geoJSON(GEO, { style: { weight: 1.5, color: '#fff', fillOpacity: .78 }, onEachFeature: (f, l) => l.on('click', () => { S.ward = f.properties.id; save(); renderAll();  }) }).addTo(map);
  map.fitBounds(wardLayer.getBounds(), { padding: [8, 8] });
  D.stations.forEach(s => L.circleMarker([s.lat, s.lon], { radius: s.kind === 'forecast' ? 6 : 3.5, color: '#0f172a', weight: s.kind === 'forecast' ? 2.5 : 1, fillColor: '#fff', fillOpacity: 1 }).addTo(map)
    .bindTooltip(() => `${s.name}<br>${T(s.kind === 'forecast' ? 'stF' : 'stE')}`));
}
function paintMap() {
  if (!wardLayer) return; const i = S.hour, by = Object.fromEntries(D.wards.map(w => [w.id, w]));
  wardLayer.eachLayer(l => { const w = by[l.feature.properties.id], v = w.base[i]; l.setStyle({ fillColor: colOf(v), weight: w.id === S.ward ? 4 : 1.5, color: w.id === S.ward ? '#0f172a' : '#fff' });
    l.bindTooltip(`<b>${w.area}</b> (${w.ward})<br>${n0(v)} µg/m³ · ${T('cat')[catI(v)]}`, { sticky: true }); if (w.id === S.ward) l.bringToFront(); });
  const bad = D.wards.filter(w => w.base[i] > 60).sort((a, b) => b.base[i] - a.base[i]), t = `${dayLabel(i)} ${hh(hourOf(i))}`;
  $('#expH').textContent = bad.length ? T('expH', { t }) : T('expNone', { t });
  $('#expPeople').textContent = bad.reduce((s, w) => s + w.pop, 0).toLocaleString('en-IN'); $('#expKids').textContent = bad.reduce((s, w) => s + w.students, 0).toLocaleString('en-IN');
  const ex = D.hours.map((_, k) => D.wards.filter(w => w.hi[k] > 60).reduce((s, w) => s + w.pop, 0)), kx = ex.indexOf(Math.max(...ex));
  const kids = D.wards.filter(w => w.hi[kx] > 60).reduce((s, w) => s + w.students, 0);
  $('#expNote').innerHTML = `${T('expPeak', { t: `${dayLabel(kx)} ${hh(hourOf(kx))}`, p: (ex[kx] / 1e5).toFixed(1), s: (kids / 1e5).toFixed(1) })} <button class="linkbtn" id="goPeak">${T('show')}</button><br><span>${T('expNote')}</span>`;
  $('#goPeak').onclick = () => { S.hour = kx; S.day = Math.floor(kx / 24); renderHour(); };
  $('#expList').innerHTML = bad.slice(0, 6).map(w => `<li><span class="sw" style="background:${colOf(w.base[i])}"></span><b>${w.area}</b><span>${n0(w.base[i])} · ${(w.pop / 1e5).toFixed(1)} lakh</span></li>`).join('');
}
function locate() {
  if (!navigator.geolocation) { $('#locMsg').textContent = T('locErr'); return; } $('#locMsg').textContent = T('locating');
  navigator.geolocation.getCurrentPosition(p => { const { latitude: la, longitude: lo } = p.coords; let best = null, bd = 1e9;
    D.wards.forEach(w => { const d = Math.hypot((w.lat - la) * 111, (w.lon - lo) * 105); if (d < bd) { bd = d; best = w; } });
    S.ward = best.id; save(); renderAll(); $('#locMsg').textContent = T(bd > 25 ? 'locFar' : 'locFound', { w: best.area }); }, () => { $('#locMsg').textContent = T('locErr'); }, { timeout: 10000 });
}

/* ---------- my day, less smoke ---------- */
// Inhalation rates, adults (US EPA Exposure Factors Handbook 2011, Table 6-2): light 0.72, moderate 1.56, high 2.94 m3/h.
const RATE = { commute: .72, walk: 1.56, run: 2.94, kids: 1.56 };
const MD = { home: null, work: null, go: 9, back: 18, ex: 'walk', exAt: 6, kids: 17 };
try { Object.assign(MD, JSON.parse(localStorage.getItem('airpulse-myday') || '{}')); } catch (e) {}
const saveMD = () => { try { localStorage.setItem('airpulse-myday', JSON.stringify(MD)); } catch (e) {} };
function initMyDay() {
  ['fHome', 'fWork', 'fGo', 'fBack', 'fEx', 'fExAt', 'fKids'].forEach(id => $('#' + id).onchange = e => { const k = { fHome: 'home', fWork: 'work', fGo: 'go', fBack: 'back', fEx: 'ex', fExAt: 'exAt', fKids: 'kids' }[id];
    MD[k] = ['go', 'back', 'exAt', 'kids'].includes(k) ? (e.target.value === 'none' ? null : +e.target.value) : e.target.value; saveMD(); renderMyDay(); });
}
function fillMyDaySelects() {
  const opts = D.wards.slice().sort((a, b) => a.area.localeCompare(b.area)).map(w => `<option value="${w.id}">${w.area}</option>`).join('');
  $('#fHome').innerHTML = opts; $('#fWork').innerHTML = `<option value="none">${T('noWork')}</option>` + opts;
  $$('.hsel').forEach(el => el.innerHTML = (el.classList.contains('nonable') || el.id === 'fGo' || el.id === 'fBack' ? `<option value="none">${T('noTime')}</option>` : '') + [...Array(24)].map((_, h) => `<option value="${h}">${hh(h)}</option>`).join(''));
  MD.home = MD.home || S.ward; MD.work = MD.work || 'none';
  $('#fHome').value = MD.home; $('#fWork').value = MD.work; $('#fGo').value = MD.go ?? 'none'; $('#fBack').value = MD.back ?? 'none'; $('#fEx').value = MD.ex; $('#fExAt').value = MD.exAt ?? 6; $('#fKids').value = MD.kids ?? 'none';
  $$('#fEx option').forEach(o => o.textContent = T(o.dataset.t));
}
function planDose(plan, d) {
  const H = D.wards.find(w => w.id === plan.home), Wk = plan.work && plan.work !== 'none' ? D.wards.find(w => w.id === plan.work) : H;
  const pm = (w, h) => w.hi[d * 24 + h], items = [];
  if (plan.go != null) items.push({ k: 'commute', h: plan.go, v: (pm(H, plan.go) + pm(Wk, plan.go)) / 2 });
  if (plan.back != null) items.push({ k: 'commute', h: plan.back, v: (pm(H, plan.back) + pm(Wk, plan.back)) / 2 });
  if (plan.ex !== 'none' && plan.exAt != null) items.push({ k: plan.ex, h: plan.exAt, v: pm(H, plan.exAt) });
  if (plan.kids != null) items.push({ k: 'kids', h: plan.kids, v: pm(H, plan.kids) });
  items.forEach(it => it.dose = it.v * RATE[it.k]); return { items, total: items.reduce((s, it) => s + it.dose, 0) };
}
function bestPlan(d) {
  const H = D.wards.find(w => w.id === MD.home), b = { ...MD }, pm = h => H.hi[d * 24 + h], arg = hs => hs.reduce((a, h) => pm(h) < pm(a) ? h : a, hs[0]);
  if (b.ex !== 'none' && b.exAt != null) b.exAt = arg([5, 6, 7, 8, 9, 16, 17, 18, 19, 20, 21]);
  if (b.kids != null) b.kids = arg([15, 16, 17, 18, 19]);
  for (const key of ['go', 'back']) { if (b[key] == null) continue;   // office hours: move by at most one hour
    const opts = [b[key] - 1, b[key], b[key] + 1].filter(x => x >= 0 && x < 24);
    b[key] = opts.reduce((best, x) => planDose({ ...b, [key]: x }, d).total < planDose({ ...b, [key]: best }, d).total ? x : best, b[key]); }
  return b;
}
function renderMyDay() {
  if (!D || !MD.home) return; const d = S.day, now = planDose(MD, d), bp = bestPlan(d), best = planDose(bp, d), el = $('#dose');
  if (!now.items.length) { el.innerHTML = `<p class="hint">${T('mdEmpty')}</p>`; return; }
  const pct = Math.round(100 * (1 - best.total / now.total)), lab = k => T('mdAct.' + k);
  const row = (pl, title) => { const on = Object.fromEntries(pl.items.map(it => [it.h, it])); return `<span>${title}</span><div class="row">${[...Array(24)].map((_, h) => { const it = on[h], w = D.wards.find(x => x.id === MD.home);
    return `<i style="background:${colOf(w.hi[d * 24 + h])}" class="${it ? 'on' : ''}" title="${hh(h)}${it ? ' · ' + lab(it.k) : ''}">${it ? ico(({ commute: 'train', walk: 'walk', run: 'run', kids: 'kids' })[it.k]) : ''}</i>`; }).join('')}</div>`; };
  const tips = []; const cmp = (k, a, b) => { if (a !== b && a != null) tips.push(T('mdTip', { what: lab(k), from: hh(a), to: hh(b) })); };
  cmp(MD.ex === 'none' ? 'walk' : MD.ex, MD.ex !== 'none' ? MD.exAt : null, bp.exAt); cmp('kids', MD.kids, bp.kids); cmp('commuteGo', MD.go, bp.go); cmp('commuteBack', MD.back, bp.back);
  el.innerHTML = `<div class="dose-top"><div><b>${n0(now.total)} µg</b><span>${T('mdNow', { d: dayLabel(d * 24) })}</span></div><div><b>${n0(best.total)} µg</b><span>${T('mdBest')}</span></div><div class="save"><b>${pct > 0 ? '−' + pct + '%' : '0%'}</b><span>${pct > 0 ? T('mdSave') : T('mdAlready')}</span></div></div>
    <div class="tl">${row(now, T('mdYour'))}${row(best, T('mdBetter'))}<span></span><div class="hrs">${[...Array(24)].map((_, h) => `<span>${h % 6 === 0 ? hh(h) : ''}</span>`).join('')}</div></div>
    ${tips.length ? `<ul class="tips">${tips.map(t => `<li>${t}</li>`).join('')}</ul>` : ''}<p class="hint">${T('mdNote')}</p>`;
  el.dataset.say = [T('mdNow', { d: dayLabel(d * 24) }) + ': ' + n0(now.total) + ' µg.', pct > 0 ? T('mdSave') + ': ' + pct + '%.' : T('mdAlready'), ...tips].join(' ');
}

/* ---------- BMC squad planner ---------- */
function nightIdx(d) { return [...Array(24)].map((_, h) => d * 24 + h).filter(k => hourOf(k) <= 6 || hourOf(k) >= 20); }
function rankRows() { const ks = nightIdx(S.day);
  return D.wards.map(w => { const ex = ks.reduce((s, k) => s + Math.max(0, w.hi[k] - 60), 0), pk = ks.reduce((a, k) => w.hi[k] > w.hi[a] ? k : a, ks[0]);
    return { w, score: w.pop * ex / 1e6, peak: pk, hours: ks.filter(k => w.hi[k] > 60).length }; }).sort((a, b) => b.score - a.score); }
function renderRank() { const r = rankRows(), mx = r[0].score || 1;
  $('#rank').innerHTML = r.slice(0, 7).map((x, i) => `<li><span class="no">${i + 1}</span><span class="nm"><b>${x.w.area}</b><span class="meta">${x.w.ward} · ${(x.w.pop / 1e5).toFixed(1)} ${T('lakh')} · ${x.w.schools} ${T('schoolsW')}</span></span><span class="pk"><b>${n0(x.w.hi[x.peak])}</b><span class="meta">${hh(hourOf(x.peak))} · ${x.hours} h</span></span><span class="bar" style="width:${Math.max(4, 100 * x.score / mx)}%"></span></li>`).join(''); }
function rankCsv() { const rows = [['rank', 'ward', 'area', 'population', 'schools', 'students', 'hours_above_60', 'peak_hour', 'peak_pm25', 'score']].concat(rankRows().map((x, i) => [i + 1, x.w.ward, x.w.area, x.w.pop, x.w.schools, x.w.students, x.hours, D.hours[x.peak], n0(x.w.hi[x.peak]), x.score.toFixed(1)]));
  const b = new Blob([rows.map(r => r.map(c => `"${String(c).replaceAll('"', '""')}"`).join(',')).join('\n')], { type: 'text/csv' }), a = document.createElement('a'); a.href = URL.createObjectURL(b); a.download = `airpulse-bmc-priority-${D.hours[S.day * 24].slice(0, 10)}.csv`; a.click(); setTimeout(() => URL.revokeObjectURL(a.href), 2000); }

/* ---------- listen (Web Speech API; uses the device's Google / system voices) ---------- */
function speak(what, btn) {
  if (!('speechSynthesis' in window)) { alertMsg(T('noVoice')); return; } const ss = window.speechSynthesis;
  if (ss.speaking) { ss.cancel(); $$('.listen').forEach(b => b.classList.remove('speaking')); return; }
  const w = W(), i = S.hour; let text = '';
  if (what === 'now') text = T('sayNow', { a: w.area, t: `${dayLabel(i)}, ${hh(hourOf(i))}`, v: n0(w.base[i]), c: T('cat')[catI(w.base[i])] });
  if (what === 'plan') text = $('#answer').innerText.replace(/\s+/g, ' ');
  if (what === 'myday') text = $('#dose').dataset.say || '';
  const want = { en: ['en-IN', 'en-GB', 'en'], hi: ['hi-IN'], mr: ['mr-IN', 'hi-IN'] }[lang], vs = ss.getVoices();
  const v = want.map(l => vs.find(x => x.lang.replace('_', '-').toLowerCase().startsWith(l.toLowerCase()))).find(Boolean);
  const u = new SpeechSynthesisUtterance(text); u.lang = v ? v.lang : want[0]; if (v) u.voice = v; u.rate = .92;
  u.onend = u.onerror = () => btn.classList.remove('speaking'); btn.classList.add('speaking'); ss.speak(u);
}
function alertMsg(m) { const t = $('#tip'); t.textContent = m; t.style.opacity = 1; t.style.left = '20px'; t.style.top = '80px'; setTimeout(() => t.style.opacity = 0, 3000); }
if ('speechSynthesis' in window) speechSynthesis.getVoices();

/* ---------- trust ---------- */
function renderTrust() { const v = D.validation.summary, h = v.holdout, o = v.oct26, p = Math.round(100 * (1 - h.rmse_blend / h.rmse_idw));
  const fill = (str, vars) => Object.entries(vars).reduce((a, [x, y]) => a.replaceAll(`{${x}}`, y), str);
  const vals = [{}, { n: v.stations_modelled }, { p, a: h.rmse_blend, b: h.rmse_idw }, { s: o.stations, a: o.rmse_blend, b: o.rmse_idw }];
  const rows = T('trust').map(([k, d], i) => [fill(k, vals[i] || {}), fill(d, vals[i] || {})]), wx = D.validation.wx;   // copy: never mutate the I18N list
  if (wx) rows.push([T('trustWxK', { p: Math.round(100 * (1 - wx.rmse_model / wx.rmse_clim)) }), T('trustWxD', { a: wx.rmse_model, b: wx.rmse_clim, c: wx.daily_corr_model })]);
  $('#trustGrid').innerHTML = rows.map(([a, b]) => `<div><b>${a}</b><p>${b}</p></div>`).join(''); }

/* ---------- share card ---------- */
function drawCard() {
  const cv = $('#card'), g = cv.getContext('2d'), w = W(), d = S.day, di = dayIdx(d), mean = di.reduce((s, k) => s + w.base[k], 0) / 24, c = catI(mean);
  const cand = ACTS.walk.win.flatMap(([s, e]) => [...Array(e - s)].map((_, k) => d * 24 + s + k));
  const best = cand.reduce((x, k) => w.base[k] < w.base[x] ? k : x, cand[0]), worst = di.reduce((x, k) => w.hi[k] > w.hi[x] ? k : x, di[0]);
  const F = (wt, px) => `${wt} ${px}px "DM Sans", "Noto Sans Devanagari", sans-serif`;
  g.fillStyle = '#ffffff'; g.fillRect(0, 0, 1080, 1350); g.fillStyle = '#e8590c'; g.fillRect(0, 0, 1080, 14);
  g.beginPath(); g.arc(98, 112, 13, 0, 7); g.fill(); g.fillStyle = '#0f172a'; g.font = F(700, 44); g.fillText('Mumbai', 126, 128); g.fillStyle = '#e8590c'; g.fillText('AirPulse', 126 + g.measureText('Mumbai ').width, 128);
  g.fillStyle = '#5b6478'; g.font = F(500, 38); g.fillText(dayLabel(d * 24), 80, 210);
  g.fillStyle = '#0f172a'; g.font = F(700, 76); wrap(g, w.area, 80, 310, 920, 88);
  g.fillStyle = COL[c]; rr(g, 80, 420, 920, 300, 28); g.fill(); g.fillStyle = '#fff'; g.font = F(700, 160); g.fillText(n0(mean), 130, 625);
  g.font = F(700, 62); g.fillText(T('cat')[c], 500, 560); g.font = F(500, 36); g.fillText(T('cardAvg'), 500, 625);
  g.strokeStyle = '#e3e7ef'; g.lineWidth = 2; rr(g, 80, 770, 440, 200, 22); g.stroke(); rr(g, 560, 770, 440, 200, 22); g.stroke();
  g.fillStyle = '#5b6478'; g.font = F(500, 34); g.fillText(T('cardBest'), 112, 830); g.fillText(T('cardAvoid'), 592, 830);
  g.fillStyle = '#2f9e44'; g.font = F(700, 80); g.fillText(hh(hourOf(best)), 112, 925); g.fillStyle = '#e03131'; g.fillText(hh(hourOf(worst)), 592, 925);
  g.fillStyle = '#0f172a'; g.font = F(700, 52); g.fillText(T('cardCig', { n: n1(mean / 22) }), 80, 1080); g.fillStyle = '#5b6478'; g.font = F(500, 32); g.fillText(T('cardCigNote'), 80, 1130);
  g.fillStyle = '#8a94a8'; g.font = F(500, 30); g.fillText('airpulse-mumbai-2026.web.app', 80, 1270); g.fillText('Google Mumbai Data Challenge 2026', 80, 1310);
}
function rr(g, x, y, w, h, r) { g.beginPath(); g.moveTo(x + r, y); g.arcTo(x + w, y, x + w, y + h, r); g.arcTo(x + w, y + h, x, y + h, r); g.arcTo(x, y + h, x, y, r); g.arcTo(x, y, x + w, y, r); g.closePath(); }
function wrap(g, text, x, y, mw, lh) { const words = text.split(' '); let line = ''; for (const wd of words) { const t = line ? line + ' ' + wd : wd; if (g.measureText(t).width > mw && line) { g.fillText(line, x, y); line = wd; y += lh; } else line = t; } g.fillText(line, x, y); }
function shareCard(dl) {
  $('#card').toBlob(async b => { const f = new File([b], `airpulse-${S.ward}-${dayLabel(S.day * 24).replace(/\s+/g, '-')}.png`, { type: 'image/png' });
    if (!dl && navigator.canShare && navigator.canShare({ files: [f] })) { try { await navigator.share({ files: [f], title: 'AirPulse Mumbai' }); return; } catch (e) { if (e.name === 'AbortError') return; } }
    const a = document.createElement('a'); a.href = URL.createObjectURL(b); a.download = f.name; a.click(); setTimeout(() => URL.revokeObjectURL(a.href), 2000); }, 'image/png');
}
if (document.fonts) document.fonts.ready.then(() => D && drawCard());
if ('serviceWorker' in navigator && location.protocol === 'https:') navigator.serviceWorker.register('sw.js').catch(() => {});
})();
