/* AirPulse Mumbai — citizen app. Data: data/city.json (ward and station forecasts for 11-12 Nov 2026) and data/wards.geo.json. */
(() => {
const $ = s => document.querySelector(s), $$ = s => [...document.querySelectorAll(s)];
const CUT = [30, 60, 90, 120, 250, Infinity];
const COL = ['#2f9e44', '#8fb339', '#e0a800', '#f08c00', '#e03131', '#a61e4d'];
const catI = v => CUT.findIndex(c => v <= c);
const colOf = v => COL[catI(v)];
const ACTS = {
  walk:    { icon: '🚶', win: [[5, 10], [16, 22]], sens: false },
  run:     { icon: '🏃', win: [[5, 10], [16, 22]], sens: false, hard: true },
  kids:    { icon: '⚽', win: [[7, 19]], sens: true },
  commute: { icon: '🚆', win: [[7, 11], [17, 22]], sens: false },
  elder:   { icon: '👵', win: [[7, 20]], sens: true },
  work:    { icon: '👷', win: [[8, 19]], sens: false, allDay: true }
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
const dayLabel = i => { const s = D.hours[i], y = +s.slice(0, 4), m = +s.slice(5, 7), d = +s.slice(8, 10); const wd = new Date(Date.UTC(y, m - 1, d)).getUTCDay();
  return `${T('days')[wd]} ${d} ${T('months')[m - 1]}`; };
const W = () => D.wards.find(w => w.id === S.ward);
const dayIdx = d => [...Array(24)].map((_, k) => d * 24 + k);

fetch('data/city.json').then(r => r.json()).then(c => { D = c; return fetch('data/wards.geo.json'); }).then(r => r.json()).then(g => { GEO = g; init(); })
  .catch(e => { $('main').insertAdjacentHTML('afterbegin', `<p class="card">Could not load data (${e}). Serve this folder over http.</p>`); });

function init() {
  if (!D.wards.some(w => w.id === S.ward)) S.ward = 'GN';
  const now = new Date(), idx = D.hours.findIndex(h => Math.abs(new Date(h + ':00+05:30') - now) < 1800e3);
  S.hour = idx >= 0 ? idx : 8; S.day = S.hour >= 24 ? 1 : 0;
  $('#ward').innerHTML = D.wards.slice().sort((a, b) => a.area.localeCompare(b.area)).map(w => `<option value="${w.id}">${w.area} (${w.ward})</option>`).join('');
  $('#ward').onchange = e => { S.ward = e.target.value; save(); renderAll(); };
  $('#locate').onclick = locate;
  $('#hour').oninput = e => { S.hour = +e.target.value; S.day = S.hour >= 24 ? 1 : 0; renderHour(); };
  $('#play').onclick = play;
  $$('.langs button').forEach(b => b.onclick = () => { lang = b.dataset.lang; save(); applyLang(); renderAll(); });
  $('#shareBtn').onclick = () => shareCard(false); $('#dlBtn').onclick = () => shareCard(true);
  buildSky(); buildMap(); applyLang(); renderAll();
}
function applyLang() {
  document.documentElement.lang = lang; $$('.langs button').forEach(b => b.setAttribute('aria-pressed', b.dataset.lang === lang));
  $$('[data-t]').forEach(el => el.textContent = T(el.dataset.t)); $('#sources').textContent = T('sources');
}
function renderAll() { $('#ward').value = S.ward; renderDays(); renderHour(); renderActs(); renderTrust(); }

/* ---------- now card ---------- */
function renderDays() {
  $('#days').innerHTML = [0, 1].map(d => `<button role="tab" aria-selected="${S.day === d}" data-d="${d}">${dayLabel(d * 24)}</button>`).join('');
  $$('#days button').forEach(b => b.onclick = () => { const d = +b.dataset.d; S.hour = d * 24 + (S.hour % 24); S.day = d; renderHour(); });
}
function renderHour() {
  const w = W(), i = S.hour, v = w.base[i], hi = w.hi[i];
  $('#hour').value = i; $('#nowArea').textContent = `${w.area} · ${w.ward}`; $('#nowTime').textContent = `${dayLabel(i)}, ${hh(hourOf(i))}`;
  $('#nowVal').textContent = n0(v); const c = catI(v); $('#nowCat').textContent = T('cat')[c]; $('#nowCat').style.background = COL[c];
  $('#nowLinger').textContent = hi - v >= 3 ? T('linger', { v: `${n0(hi)} · ${T('cat')[catI(hi)]}` }) : T('lingerSame');
  $$('#days button').forEach(b => b.setAttribute('aria-selected', +b.dataset.d === S.day));
  const di = dayIdx(S.day), mean = di.reduce((s, k) => s + w.base[k], 0) / 24;
  const worst = di.reduce((a, k) => w.hi[k] > w.hi[a] ? k : a, di[0]), best = di.reduce((a, k) => w.base[k] < w.base[a] ? k : a, di[0]);
  $('#cig').textContent = T('cigs', { n: n1(mean / 22) }); $('#worst').textContent = `${hh(hourOf(worst))} · ${n0(w.hi[worst])}`; $('#best').textContent = `${hh(hourOf(best))} · ${n0(w.base[best])}`;
  $('#ribbon').innerHTML = w.base.map((b, k) => `<i style="background:${colOf(b)}" class="${k === i ? 'on' : ''}" data-k="${k}" title="${dayLabel(k)} ${hh(hourOf(k))}: ${n0(b)}"></i>`).join('');
  $$('#ribbon i').forEach(el => el.onclick = () => { S.hour = +el.dataset.k; S.day = S.hour >= 24 ? 1 : 0; renderHour(); });
  $('#ticks').innerHTML = [0, 6, 12, 18, 24, 30, 36, 42].map(k => `<span style="left:${100 * k / 47}%">${k % 24 === 0 ? dayLabel(k).split(' ').slice(0, 2).join(' ') : hh(hourOf(k))}</span>`).join('');
  paintSky(hourOf(i), v); paintMap(); renderPlan(); drawCard();
}

/* ---------- skyline ---------- */
function buildSky() {
  let seed = 7; const rnd = () => (seed = (seed * 16807) % 2147483647) / 2147483647; const svg = $('#sky'); let b = '', win = '';
  for (let x = 0; x < 1000;) { const w = 26 + rnd() * 46, h = 60 + rnd() * (x > 380 && x < 640 ? 210 : 140); b += `<rect x="${x}" y="${300 - h}" width="${w}" height="${h}"/>`;
    for (let yy = 300 - h + 10; yy < 290; yy += 16) for (let xx = x + 6; xx < x + w - 8; xx += 12) if (rnd() > .55) win += `<rect x="${xx}" y="${yy}" width="5" height="7"/>`;
    if (rnd() > .82) b += `<rect x="${x + w / 2 - 2}" y="${300 - h - 30}" width="4" height="30"/>`; x += w + 2 + rnd() * 8; }
  let far = ''; for (let x = -20; x < 1000;) { const w = 30 + rnd() * 60, h = 40 + rnd() * 120; far += `<rect x="${x}" y="${300 - h}" width="${w}" height="${h}" rx="2"/>`; x += w - 6; }
  svg.innerHTML = `<defs><linearGradient id="skyG" x1="0" y1="0" x2="0" y2="1"><stop id="s1" offset="0"/><stop id="s2" offset="1"/></linearGradient></defs>
    <rect width="1000" height="360" fill="url(#skyG)"/><circle id="orb" r="26"/><g id="far" opacity=".45">${far}</g>
    <g id="city">${b}<path d="M640 300 L720 250 L800 300 M720 250 L720 300 M680 275 L760 275" stroke-width="5" fill="none" id="bridge"/></g><g id="wins">${win}</g>
    <rect y="300" width="1000" height="60" id="sea"/><path id="waves" d="M0 318 q25 -6 50 0 t50 0 t50 0 t50 0 t50 0 t50 0 t50 0 t50 0 t50 0 t50 0 t50 0 t50 0 t50 0 t50 0 t50 0 t50 0 t50 0 t50 0 t50 0 t50 0" fill="none" stroke-width="2"/>
    <rect width="1000" height="360" id="haze"/>`;
}
function paintSky(h, v) {
  const day = h >= 7 && h <= 18, dusk = h === 6 || h === 19, k = Math.min(.82, Math.max(0, (v - 18) / 120));
  const top = day ? '#7cc4f2' : dusk ? '#f4a259' : '#0c1a3a', bot = day ? '#d8eefb' : dusk ? '#f8d6a8' : '#28406b';
  $('#s1').setAttribute('stop-color', top); $('#s2').setAttribute('stop-color', bot);
  const a = ((h + 18) % 24) / 24 * Math.PI; $('#orb').setAttribute('cx', 500 - 420 * Math.cos(a)); $('#orb').setAttribute('cy', 280 - 220 * Math.sin(a)); $('#orb').setAttribute('fill', day || dusk ? '#ffd166' : '#f1f3f8');
  $('#city').setAttribute('fill', day ? '#2f4a60' : '#111a2e'); $('#far').setAttribute('fill', day ? '#6f8ea6' : '#24365a'); $('#bridge').setAttribute('stroke', day ? '#3d5a73' : '#16213a');
  $('#wins').setAttribute('fill', day ? 'transparent' : '#ffd88a'); $('#sea').setAttribute('fill', day ? '#2f6f8f' : '#0d2238'); $('#waves').setAttribute('stroke', day ? '#9fd3ea' : '#2f5878');
  $('#haze').setAttribute('fill', v > 90 ? '#7a5c3e' : '#9a8f84'); $('#haze').setAttribute('opacity', k.toFixed(2));
}
let timer = null;
function play() { if (timer) { clearInterval(timer); timer = null; $('#play span').textContent = '▶'; return; }
  $('#play span').textContent = '❚❚'; timer = setInterval(() => { S.hour = (S.hour + 1) % 48; S.day = S.hour >= 24 ? 1 : 0; renderHour(); }, 450); }

/* ---------- plan my day ---------- */
function renderActs() {
  $('#acts').innerHTML = Object.entries(ACTS).map(([k, a]) => `<button role="radio" aria-checked="${S.act === k}" data-a="${k}"><span class="ai" aria-hidden="true">${a.icon}</span><span>${T('acts.' + k)}</span></button>`).join('');
  $$('#acts button').forEach(b => b.onclick = () => { S.act = b.dataset.a; save(); renderActs(); renderPlan(); });
}
function advice(v, a) { const c = catI(v); if (c <= 1) return a.sens && c === 1 ? T('adv.ok') : T('adv.ok'); if (c === 2) return a.sens || a.hard ? T('adv.sens_mod') : T('adv.mod'); if (c === 3) return T('adv.poor'); return T('adv.vpoor'); }
function renderPlan() {
  const w = W(), a = ACTS[S.act], d = S.day, cand = a.win.flatMap(([s, e]) => [...Array(e - s)].map((_, k) => d * 24 + s + k));
  const best = cand.reduce((x, k) => w.base[k] < w.base[x] ? k : x, cand[0]), worst = cand.reduce((x, k) => w.hi[k] > w.hi[x] ? k : x, cand[0]);
  const lo = Math.min(...cand.map(k => w.base[k])), hi_ = Math.max(...cand.map(k => w.base[k])), H_ = v => 18 + 82 * (v - lo) / Math.max(1, hi_ - lo);
  const bar = cand.map(k => `<i style="background:${colOf(w.base[k])};height:${H_(w.base[k])}%" class="${k === best ? 'best' : k === worst ? 'worst' : ''}" title="${hh(hourOf(k))}: ${n0(w.base[k])}"><b>${k === best || k === worst ? n0(w.base[k]) : ''}</b><em>${hourOf(k) % 3 === 0 ? hh(hourOf(k)) : ''}</em></i>`).join('');
  if (a.allDay) { const m = cand.reduce((s, k) => s + w.base[k], 0) / cand.length;
    $('#answer').innerHTML = `<div class="ans-main"><span class="ai big" aria-hidden="true">${a.icon}</span><div><p class="eyebrow">${dayLabel(d * 24)} · ${w.area}</p><h3>${T('workNote', { v: n0(m), c: T('cat')[catI(m)], t: hh(hourOf(worst)) })}</h3><p>${advice(w.hi[worst], a)}</p></div></div><div class="bars">${bar}</div>`; return; }
  $('#answer').innerHTML = `<div class="ans-main"><span class="ai big" aria-hidden="true">${a.icon}</span><div><p class="eyebrow">${dayLabel(d * 24)} · ${w.area} · ${T('acts.' + S.act)}</p>
    <h3>${T('go', { t: hh(hourOf(best)) })} <span class="chip" style="background:${colOf(w.base[best])}">${T('cat')[catI(w.base[best])]} · ${n0(w.base[best])}</span></h3>
    <p class="avoid">${T('avoid')}: <b>${hh(hourOf(worst))}</b> · ${T('upto', { v: n0(w.hi[worst]) })}</p><p>${advice(w.base[best], a)}</p></div></div><div class="bars" aria-hidden="true">${bar}</div>`;
}

/* ---------- city map ---------- */
function buildMap() {
  map = L.map('map', { scrollWheelZoom: false, zoomSnap: .25, attributionControl: true }).setView([19.07, 72.87], 11);
  L.tileLayer('https://server.arcgisonline.com/ArcGIS/rest/services/Canvas/World_Light_Gray_Base/MapServer/tile/{z}/{y}/{x}', { attribution: 'Tiles © Esri', maxZoom: 16 }).addTo(map);
  wardLayer = L.geoJSON(GEO, { style: { weight: 1.5, color: '#fff', fillOpacity: .78 }, onEachFeature: (f, l) => l.on('click', () => { S.ward = f.properties.id; save(); renderAll(); document.querySelector('.now').scrollIntoView({ behavior: 'smooth' }); }) }).addTo(map);
  map.fitBounds(wardLayer.getBounds(), { padding: [8, 8] });
  D.stations.forEach(s => L.circleMarker([s.lat, s.lon], { radius: s.kind === 'forecast' ? 6 : 3.5, color: '#0f3d3e', weight: s.kind === 'forecast' ? 2.5 : 1, fillColor: '#fff', fillOpacity: 1 }).addTo(map)
    .bindTooltip(`${s.name}<br>${s.kind === 'forecast' ? 'forecast station' : 'estimated station'}`));
  $('#legend').innerHTML = COL.map((c, i) => `<span><i style="background:${c}"></i>${T('cat')[i]}</span>`).join('') + `<span><i class="dot big"></i>forecast station</span><span><i class="dot"></i>estimated station</span>`;
}
function paintMap() {
  if (!wardLayer) return; const i = S.hour, by = Object.fromEntries(D.wards.map(w => [w.id, w]));
  wardLayer.eachLayer(l => { const w = by[l.feature.properties.id], v = w.base[i]; l.setStyle({ fillColor: colOf(v), weight: w.id === S.ward ? 4 : 1.5, color: w.id === S.ward ? '#0f3d3e' : '#fff' });
    l.bindTooltip(`<b>${w.area}</b> (${w.ward})<br>${n0(v)} µg/m³ · ${T('cat')[catI(v)]}`, { sticky: true }); if (w.id === S.ward) l.bringToFront(); });
  const bad = D.wards.filter(w => w.base[i] > 60).sort((a, b) => b.base[i] - a.base[i]), t = `${dayLabel(i)} ${hh(hourOf(i))}`;
  $('#expH').textContent = bad.length ? T('expH', { t }) : T('expNone', { t });
  $('#expPeople').textContent = bad.reduce((s, w) => s + w.pop, 0).toLocaleString('en-IN'); $('#expKids').textContent = bad.reduce((s, w) => s + w.students, 0).toLocaleString('en-IN');
  const ex = D.hours.map((_, k) => D.wards.filter(w => w.hi[k] > 60).reduce((s, w) => s + w.pop, 0)), kx = ex.indexOf(Math.max(...ex));
  const kids = D.wards.filter(w => w.hi[kx] > 60).reduce((s, w) => s + w.students, 0);
  $('#expNote').innerHTML = `${T('expPeak', { t: `${dayLabel(kx)} ${hh(hourOf(kx))}`, p: (ex[kx] / 1e5).toFixed(1), s: (kids / 1e5).toFixed(1) })} <button class="linkbtn" id="goPeak">${T('show')}</button><br><span>${T('expNote')}</span>`;
  $('#goPeak').onclick = () => { S.hour = kx; S.day = kx >= 24 ? 1 : 0; renderHour(); };
  $('#expList').innerHTML = bad.slice(0, 6).map(w => `<li><span class="sw" style="background:${colOf(w.base[i])}"></span><b>${w.area}</b><span>${n0(w.base[i])} · ${(w.pop / 1e5).toFixed(1)} lakh</span></li>`).join('');
}
function locate() {
  if (!navigator.geolocation) { $('#locMsg').textContent = T('locErr'); return; } $('#locMsg').textContent = T('locating');
  navigator.geolocation.getCurrentPosition(p => { const { latitude: la, longitude: lo } = p.coords; let best = null, bd = 1e9;
    D.wards.forEach(w => { const d = Math.hypot((w.lat - la) * 111, (w.lon - lo) * 105); if (d < bd) { bd = d; best = w; } });
    S.ward = best.id; save(); renderAll(); $('#locMsg').textContent = T(bd > 25 ? 'locFar' : 'locFound', { w: best.area }); }, () => { $('#locMsg').textContent = T('locErr'); }, { timeout: 10000 });
}

/* ---------- trust ---------- */
function renderTrust() { const v = D.validation.summary, h = v.holdout, o = v.oct26, p = Math.round(100 * (1 - h.rmse_blend / h.rmse_idw)), tr = T('trust');
  const vals = [{}, { n: v.stations_modelled }, { p, a: h.rmse_blend, b: h.rmse_idw }, { s: o.stations, a: o.rmse_blend, b: o.rmse_idw }];
  $('#trust').innerHTML = tr.map(([k, d], i) => { let a = k, b = d; Object.entries(vals[i]).forEach(([x, y]) => { a = a.replaceAll(`{${x}}`, y); b = b.replaceAll(`{${x}}`, y); }); return `<div><b>${a}</b><p>${b}</p></div>`; }).join(''); }

/* ---------- share card ---------- */
function drawCard() {
  const cv = $('#card'), g = cv.getContext('2d'), w = W(), d = S.day, di = dayIdx(d), mean = di.reduce((s, k) => s + w.base[k], 0) / 24, c = catI(mean);
  const act = ACTS.walk, cand = act.win.flatMap(([s, e]) => [...Array(e - s)].map((_, k) => d * 24 + s + k));
  const best = cand.reduce((x, k) => w.base[k] < w.base[x] ? k : x, cand[0]), worst = di.reduce((x, k) => w.hi[k] > w.hi[x] ? k : x, di[0]);
  const F = (wt, px) => `${wt} ${px}px "DM Sans", "Noto Sans Devanagari", sans-serif`;
  const grd = g.createLinearGradient(0, 0, 0, 1350); grd.addColorStop(0, '#0f3d3e'); grd.addColorStop(1, '#16585a'); g.fillStyle = grd; g.fillRect(0, 0, 1080, 1350);
  g.fillStyle = '#ffffff'; g.font = F(700, 44); g.fillText('AirPulse Mumbai', 80, 120); g.font = F(500, 40); g.fillStyle = '#cfe7e4'; g.fillText(dayLabel(d * 24), 80, 180);
  g.fillStyle = '#fff'; g.font = F(800, 72); wrap(g, T('cardTitle', { w: w.area }), 80, 300, 920, 84);
  g.fillStyle = COL[c]; rr(g, 80, 420, 920, 300, 36); g.fill(); g.fillStyle = '#fff'; g.font = F(800, 150); g.fillText(n0(mean), 130, 610); g.font = F(700, 64); g.fillText(T('cat')[c], 470, 560);
  g.font = F(500, 38); g.fillText('µg/m³ PM2.5', 470, 625); g.fillStyle = '#fff'; g.font = F(500, 40); g.fillText(T('cardBest'), 80, 820); g.font = F(800, 72); g.fillText(hh(hourOf(best)), 80, 900);
  g.font = F(500, 40); g.fillStyle = '#cfe7e4'; g.fillText(T('cardAvoid'), 560, 820); g.font = F(800, 72); g.fillStyle = '#ffd0c4'; g.fillText(hh(hourOf(worst)), 560, 900);
  g.fillStyle = '#fff'; g.font = F(700, 56); g.fillText('🚬 ' + T('cardCig', { n: n1(mean / 22) }), 80, 1040);
  g.font = F(500, 34); g.fillStyle = '#cfe7e4'; g.fillText(T('cardFoot', { d: dayLabel(d * 24) }), 80, 1250); g.fillText('Google Mumbai Data Challenge 2026', 80, 1300);
}
function rr(g, x, y, w, h, r) { g.beginPath(); g.moveTo(x + r, y); g.arcTo(x + w, y, x + w, y + h, r); g.arcTo(x + w, y + h, x, y + h, r); g.arcTo(x, y + h, x, y, r); g.arcTo(x, y, x + w, y, r); g.closePath(); }
function wrap(g, text, x, y, mw, lh) { const words = text.split(' '); let line = ''; for (const wd of words) { const t = line ? line + ' ' + wd : wd; if (g.measureText(t).width > mw && line) { g.fillText(line, x, y); line = wd; y += lh; } else line = t; } g.fillText(line, x, y); }
function shareCard(dl) {
  $('#card').toBlob(async b => { const f = new File([b], `airpulse-${S.ward}-${S.day ? '12' : '11'}nov.png`, { type: 'image/png' });
    if (!dl && navigator.canShare && navigator.canShare({ files: [f] })) { try { await navigator.share({ files: [f], title: 'AirPulse Mumbai' }); return; } catch (e) { if (e.name === 'AbortError') return; } }
    const a = document.createElement('a'); a.href = URL.createObjectURL(b); a.download = f.name; a.click(); setTimeout(() => URL.revokeObjectURL(a.href), 2000); }, 'image/png');
}
if (document.fonts) document.fonts.ready.then(() => D && drawCard());
})();
