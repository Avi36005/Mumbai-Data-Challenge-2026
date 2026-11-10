/* Mumbai AirPulse — static dashboard. Data: ./data/*.json written by build_data.py from the project's real artefacts. */
(() => {
const $ = s => document.querySelector(s);
const CPCB = [[30,'Good','--good'],[60,'Satisfactory','--sat'],[90,'Moderate','--mod'],[120,'Poor','--poor'],[250,'Very poor','--vpoor'],[Infinity,'Severe','--severe']];
const css = v => getComputedStyle(document.documentElement).getPropertyValue(v).trim();
const band = v => CPCB.find(b => v <= b[0]);
const bandColor = v => css(band(v)[2]);
const fmt = (v,d=0) => v == null || isNaN(v) ? '–' : (+v).toFixed(d);
const IST = s => new Date(s.length <= 16 ? s + ':00+05:30' : s);
const tip = $('#tip');
const showTip = (e,html) => { tip.innerHTML = html; tip.style.opacity = 1; const x = Math.min(e.clientX + 14, innerWidth - 270); tip.style.left = x + 'px'; tip.style.top = (e.clientY + 14) + 'px'; };
const hideTip = () => tip.style.opacity = 0;
const COLORS = { base:'--amber', lo:'--teal', hi:'--vpoor', actual:'--text', rule:'--fog', model:'--amber', pair:'--teal' };
const C = k => css(COLORS[k] || k);

/* theme */
const root = document.documentElement;
try { const t = localStorage.getItem('airpulse-theme'); if (t) root.dataset.theme = t; } catch (e) {}
const QS = new URLSearchParams(location.search); if (QS.get('theme')) root.dataset.theme = QS.get('theme');
const STATIC = QS.has('static'); if (STATIC) document.documentElement.classList.add('static');
$('#themeBtn').onclick = () => { const cur = root.dataset.theme || 'light';
  root.dataset.theme = cur === 'light' ? 'dark' : 'light'; try { localStorage.setItem('airpulse-theme', root.dataset.theme); } catch (e) {} location.reload(); };

/* reveal on scroll */
const io = new IntersectionObserver(es => es.forEach(e => { if (e.isIntersecting) { e.target.classList.add('in'); io.unobserve(e.target); } }), { threshold: .12 });
const watch = () => document.querySelectorAll('.reveal:not(.in)').forEach(el => STATIC ? el.classList.add('in') : io.observe(el));

const files = ['meta','stations','history','forecast','knows','skill','festival','weather','health'];
let D = {}, ST = {}, state = { fc: null, wx: null, route: 'G24' };
Promise.all(files.map(f => fetch(`data/${f}.json`).then(r => r.json()))).then(arr => {
  files.forEach((f, i) => D[f] = arr[i]); D.stations.forEach(s => ST[s.id] = s);
  state.fc = state.wx = D.stations[0].id; init();
}).catch(err => { document.querySelector('main').insertAdjacentHTML('afterbegin', `<p class="chip">Could not load data (${err}). Serve this folder over http (python -m http.server).</p>`); });

function stationLevel(id) {
  if (D.forecast.status === 'built') { const h = D.forecast.hourly[id]; return { v: d3.mean(h, r => r[1]), lo: d3.mean(h, r => r[2]), hi: d3.mean(h, r => r[3]), label: '11–12 Nov forecast mean' }; }
  const h = D.history.hourly[id]; const last = h.slice(-24); return { v: d3.mean(last, r => r[1]), label: 'last 24 h observed mean' };
}
function init() {
  heroMeta(); summary(); pulses(); map(); tabs('#fcTabs', 'fc', drawForecast); tabs('#wxTabs', 'wx', drawWeather); routeTabs();
  drawAll(); watch();
  $('#foot').textContent = `Data generated ${D.meta.generated} · package ${D.meta.package} · ${D.meta.train_rows.toLocaleString()} official hourly rows · forecast: ${D.forecast.status}.`;
  let t; addEventListener('resize', () => { clearTimeout(t); t = setTimeout(redrawAll, 150); });
}
function drawAll() { drawForecast(); drawKnow(); drawSkill(); drawDiwaliTests(); drawUnseen(); drawFest(); drawNight(); drawWeather(); drawHealth(); }
function redrawAll() { if (D.meta) { pulses(); drawAll(); } }

function summary() {
  const el = $('#summary'); if (!el || D.forecast.status !== 'built') return; const H = D.forecast.hourly, ids = D.stations.map(s => s.id);
  const all = ids.flatMap(id => H[id].map(r => ({ id, t: IST(r[0]), b: r[1], hi: r[3] }))), byT = d3.rollups(all, v => ({ b: d3.mean(v, r => r.b), hi: d3.mean(v, r => r.hi) }), r => +r.t).map(([t, v]) => ({ t: new Date(t), ...v })).sort((a, b) => a.t - b.t);
  const worst = byT.reduce((a, r) => r.hi > a.hi ? r : a), best = byT.filter(r => r.t.getHours() >= 6).reduce((a, r) => r.b < a.b ? r : a);
  const mean = id => d3.mean(H[id], r => r[1]), rank = ids.slice().sort((a, b) => mean(b) - mean(a));
  el.innerHTML = [['🌙', 'Worst hour', `${d3.timeFormat('%a %d, %H:00')(worst.t)}`, `about ${fmt(worst.hi)} µg/m³ across the four stations if festival smoke lingers (${band(worst.hi)[1]})`],
    ['☀️', 'Cleanest hour', `${d3.timeFormat('%a %d, %H:00')(best.t)}`, `about ${fmt(best.b)} µg/m³ (${band(best.b)[1]}): mid-afternoon, when the GFS forecast has the most air mixing (ventilation)`],
    ['📍', 'Most polluted station', ST[rank[0]].short, `${fmt(mean(rank[0]))} µg/m³ on average; cleanest is ${ST[rank[rank.length - 1]].short} at ${fmt(mean(rank[rank.length - 1]))}`],
    ['🌧️', 'Rain to clear it', 'None forecast', '0 mm over both days and weak wind, so smoke can linger at night']]
    .map(([ic, k, v, p], i) => `<div class="sum reveal" style="--d:${.06 * i}s"><span class="ic">${ic}</span><div><div class="k">${k}</div><div class="v">${v}</div><p>${p}</p></div></div>`).join(''); watch();
}
function heroMeta() {
  const f = D.forecast, k = D.knows;
  const chips = [[`${D.stations.length}`, 'official stations'], [`${D.meta.train_rows.toLocaleString()}`, 'hourly readings'],
    [f.status === 'built' ? 'live' : 'pending', '11–12 Nov forecast'], [`${k.gap_h} h`, 'forecast lead'], [`${d3.sum(Object.values(k.stations), s => s.capped)}`, 'fireworks hours capped']];
  $('#heroMeta').innerHTML = chips.map(c => `<span class="chip"><b>${c[0]}</b> ${c[1]}</span>`).join('');
}
function pulses() {
  $('#pulses').innerHTML = D.stations.map((s, i) => { const L = stationLevel(s.id), b = band(L.v), col = css(b[2]);
    const rate = Math.max(1.1, 4 - L.v / 30).toFixed(2) + 's';
    const range = L.lo != null ? `${fmt(L.hi)} µg/m³ if smoke lingers at night` : `${D.health[s.id].coverage}% data coverage`;
    return `<div class="pulse reveal" style="--d:${.08 * i}s;--rate:${rate};color:${col}" data-id="${s.id}" tabindex="0" role="button" aria-label="${s.short}">
      <div class="ring"></div><h3 style="color:var(--text)">${s.short}</h3><div class="op">${s.operator} · #${s.id}</div>
      <div class="big" style="color:var(--text)">${fmt(L.v)}<small>µg/m³</small></div>
      <span class="band" style="background:${col}">${b[1]}</span><div class="sub">${L.label}<br>${range}</div></div>`; }).join('');
  document.querySelectorAll('.pulse').forEach(el => el.onclick = el.onkeydown = e => { if (e.type === 'keydown' && e.key !== 'Enter') return; state.fc = state.wx = el.dataset.id; syncTabs(); drawForecast(); drawWeather(); location.hash = '#forecast'; });
  watch();
}
function map() {
  if (!window.L) return;
  const m = L.map('map', { zoomControl: false, attributionControl: true, scrollWheelZoom: false }).setView([19.1, 72.86], 11);
  L.tileLayer(`https://server.arcgisonline.com/ArcGIS/rest/services/Canvas/World_${root.dataset.theme === 'dark' ? 'Dark' : 'Light'}_Gray_Base/MapServer/tile/{z}/{y}/{x}`, { attribution: 'Tiles &copy; Esri &mdash; Esri, HERE, Garmin, &copy; OpenStreetMap contributors', maxZoom: 16 }).addTo(m);
  const pts = [];
  D.stations.forEach(s => { const L_ = stationLevel(s.id), col = bandColor(L_.v), rate = Math.max(1.1, 4 - L_.v / 30).toFixed(2) + 's';
    const icon = L.divIcon({ className: '', html: `<div class="map-pin" style="background:${col};color:${col};--rate:${rate}"></div>`, iconSize: [22, 22], iconAnchor: [11, 11] });
    L.marker([s.lat, s.lon], { icon }).addTo(m).bindTooltip(`<b>${s.short}</b><br>${fmt(L_.v)} µg/m³ · ${band(L_.v)[1]}`); pts.push([s.lat, s.lon]); });
  m.fitBounds(pts, { padding: [70, 70] });
  $('#mapLegend').innerHTML = CPCB.map((b, i) => `<span style="border-left:3px solid ${css(b[2])}">${b[1]} ${i ? CPCB[i - 1][0] + 1 : 0}${isFinite(b[0]) ? '–' + b[0] : '+'}</span>`).join('');
}
function tabs(sel, key, draw) {
  $(sel).innerHTML = D.stations.map(s => `<button role="tab" data-id="${s.id}">${s.short}</button>`).join('');
  $(sel).querySelectorAll('button').forEach(b => b.onclick = () => { state[key] = b.dataset.id; syncTabs(); draw(); }); syncTabs();
}
function syncTabs() { [['#fcTabs', 'fc'], ['#wxTabs', 'wx']].forEach(([s, k]) => document.querySelectorAll(`${s} button`).forEach(b => b.setAttribute('aria-selected', b.dataset.id === state[k]))); }
function routeTabs() {
  const r = D.skill.routes; $('#routeTabs').innerHTML = Object.keys(r).map(k => `<button data-r="${k}">${k} · ${r[k].gap_h} h ahead${k === 'G24' ? ' · the route we used' : ''}</button>`).join('');
  const sync = () => document.querySelectorAll('#routeTabs button').forEach(b => b.setAttribute('aria-selected', b.dataset.r === state.route));
  document.querySelectorAll('#routeTabs button').forEach(b => b.onclick = () => { state.route = b.dataset.r; sync(); drawSkill(); }); sync();
}

/* chart scaffold */
function frame(sel, m = { t: 16, r: 18, b: 34, l: 46 }) {
  const svg = d3.select(sel); svg.selectAll('*').remove(); const W = svg.node().clientWidth, H = svg.node().clientHeight;
  svg.attr('viewBox', `0 0 ${W} ${H}`); const g = svg.append('g').attr('transform', `translate(${m.l},${m.t})`);
  return { svg, g, w: W - m.l - m.r, h: H - m.t - m.b, m };
}
const timeAxis = (g, x, h, w) => g.append('g').attr('transform', `translate(0,${h})`).call(d3.axisBottom(x).ticks(Math.max(3, Math.floor(w / 150))).tickFormat(d3.timeFormat('%d %b %Hh'))).call(a => a.select('.domain').remove());
const yAxis = (g, y, w, label) => { g.append('g').attr('class', 'grid').call(d3.axisLeft(y).ticks(5).tickSize(-w)).call(a => a.select('.domain').remove()).selectAll('text').attr('x', -6);
  if (label) g.append('text').attr('x', 0).attr('y', -4).text(label); };
function legend(sel, items) { $(sel).innerHTML = items.map(([k, label, box]) => `<span><i class="${box ? 'box' : ''}" style="background:${C(k)}"></i>${label}</span>`).join(''); }
function hover(g, x, w, h, rows, html) {
  const line = g.append('line').attr('y1', 0).attr('y2', h).attr('stroke', css('--fog')).attr('stroke-dasharray', '3 3').style('opacity', 0);
  g.append('rect').attr('width', w).attr('height', h).attr('fill', 'transparent').on('mousemove', e => {
    const t = x.invert(d3.pointer(e)[0]); const i = d3.bisector(r => r.t).center(rows, t); const r = rows[i]; if (!r) return;
    line.attr('x1', x(r.t)).attr('x2', x(r.t)).style('opacity', 1); showTip(e, html(r)); }).on('mouseleave', () => { line.style('opacity', 0); hideTip(); });
}

/* 01 forecast */
function drawForecast() {
  const id = state.fc, s = ST[id], built = D.forecast.status === 'built';
  if (built) {
    const f = D.forecast; $('#forecastIntro').innerHTML = `PM2.5 for 11–12 November at each station, exactly as submitted. The solid line is the <strong>expected</strong> forecast; the dashed line is the <strong>smoky-nights</strong> version, for the case where festival smoke lingers after dark as it did in 2019 and 2024. Forecast origin ${f.origin.slice(0, 16)}, GFS runs ${f.weather_cycles.map(c => c.slice(5, 13).replace('T', ' ') + 'Z').join(' / ')}.`;
    const hist = D.history.hourly[id].slice(-24 * 2).map(r => ({ t: IST(r[0]), y: r[1] }));
    const rows = f.hourly[id].map(r => ({ t: IST(r[0]), base: r[1], lo: r[2], hi: r[3] }));
    const { g, w, h } = frame('#fcChart', { t: 26, r: 92, b: 44, l: 52 }); const x = d3.scaleTime().domain([hist[0].t, rows[rows.length - 1].t]).range([0, w]);
    const cap = Math.max(150, Math.ceil(d3.max(rows, d => d.hi) * 1.2 / 10) * 10), y = d3.scaleLinear().domain([0, cap]).range([h, 0]).clamp(true);
    bands(g, y, w, false); yAxis(g, y, w, 'PM2.5, µg/m³');
    g.append('g').attr('transform', `translate(0,${h})`).call(d3.axisBottom(x).ticks(d3.timeHour.every(6)).tickFormat(t => t.getHours() === 0 ? '' : d3.timeFormat('%H:00')(t))).call(a => a.select('.domain').remove());
    d3.timeDays(hist[0].t, d3.timeHour.offset(rows[rows.length - 1].t, 1)).forEach(d => { g.append('line').attr('x1', x(d)).attr('x2', x(d)).attr('y1', 0).attr('y2', h + 30).attr('stroke', css('--line')).attr('stroke-width', 1.5);
      g.append('text').attr('class', 'day-label').attr('x', x(d) + 6).attr('y', h + 36).text(d3.timeFormat('%a %d %b')(d)); });
    let lo_ = 0; CPCB.forEach(([hi_, name, v]) => { const a_ = Math.max(lo_, 0), b_ = Math.min(hi_, cap); if (b_ > a_ && y(a_) - y(b_) > 16) g.append('text').attr('class', 'band-label').attr('x', w + 8).attr('y', (y(a_) + y(b_)) / 2 + 5).style('fill', css(v)).text(name); lo_ = hi_; });
    g.append('text').attr('class', 'zone-label').attr('x', x(rows[0].t) + 8).attr('y', -10).text('FORECAST →'); g.append('text').attr('class', 'zone-label').attr('x', x(rows[0].t) - 8).attr('y', -10).attr('text-anchor', 'end').text('← MEASURED');
    g.append('rect').attr('x', x(rows[0].t)).attr('width', x(rows[rows.length - 1].t) - x(rows[0].t)).attr('height', h).attr('fill', css('--amber')).attr('opacity', .05);
    g.append('path').datum(hist).attr('d', d3.line().defined(d => d.y != null).x(d => x(d.t)).y(d => y(d.y))).attr('fill', 'none').attr('stroke', C('actual')).attr('stroke-width', 2).attr('opacity', .85);
    const off = hist.filter(d => d.y > cap); if (off.length) g.append('text').attr('x', x(rows[0].t) - 8).attr('y', 16).attr('text-anchor', 'end').style('fill', css('--vpoor')).text(`fireworks peaks cut off (max ${fmt(d3.max(off, d => d.y))})`);
    g.append('path').datum(rows).attr('d', d3.area().x(d => x(d.t)).y0(d => y(d.lo)).y1(d => y(d.hi)).curve(d3.curveMonotoneX)).attr('fill', C('base')).attr('opacity', .2);
    g.append('path').datum(rows).attr('d', d3.line().x(d => x(d.t)).y(d => y(d.hi)).curve(d3.curveMonotoneX)).attr('fill', 'none').attr('stroke', C('hi')).attr('stroke-width', 2.4).attr('stroke-dasharray', '7 5');
    g.append('path').datum(rows).attr('d', d3.line().x(d => x(d.t)).y(d => y(d.base)).curve(d3.curveMonotoneX)).attr('fill', 'none').attr('stroke', C('base')).attr('stroke-width', 3.4);
    hover(g, x, w, h, [...hist.map(d => ({ ...d, kind: 'obs' })), ...rows].sort((a, b) => a.t - b.t), r => r.base != null ? `<b>${d3.timeFormat('%a %d %b %H:00')(r.t)}</b><br>expected ${fmt(r.base)} · ${band(r.base)[1]}<br>if smoke lingers ${fmt(r.hi)} · ${band(r.hi)[1]}` : `<b>${d3.timeFormat('%a %d %b %H:00')(r.t)}</b><br>observed ${fmt(r.y)}`);
    legend('#fcLegend', [['actual', 'Measured (last 2 days)'], ['base', 'Expected (submitted file 1)'], ['hi', 'Smoky-nights version (submitted file 2)']]);
    const mean = d3.mean(rows, r => r.base), mx = d3.max(rows, r => r.hi), worst = rows.find(r => r.hi === mx);
    const win = k => { const day = rows.filter(r => d3.timeFormat('%d')(r.t) === k && r.t.getHours() >= 6 && r.t.getHours() <= 20); let best = null;
      for (let i = 0; i + 2 < day.length; i++) { const m = d3.mean(day.slice(i, i + 3), r => r.base); if (!best || m < best.m) best = { m, t: day[i].t }; } return best; };
    const b11 = win('11'), b12 = win('12'), hh = t => d3.timeFormat('%H:00')(t) + '–' + d3.timeFormat('%H:00')(d3.timeHour.offset(t, 3));
    $('#fcCallouts').innerHTML = callouts([['Expected mean, 11–12 Nov', fmt(mean), `µg/m³ · ${band(mean)[1]} on the CPCB scale`], ['Best time outdoors, Wed 11', hh(b11.t), `about ${fmt(b11.m)} µg/m³ · ${band(b11.m)[1]}`],
      ['Best time outdoors, Thu 12', hh(b12.t), `about ${fmt(b12.m)} µg/m³ · ${band(b12.m)[1]}`], ['Hour to avoid', d3.timeFormat('%a %H:00')(worst.t), `up to ${fmt(mx)} µg/m³ if smoke lingers · ${band(mx)[1]}`]]);
    ribbon(rows);
  } else {
    $('#forecastIntro').innerHTML = `The 11–12 November forecast is built on 10 November from the final data release. Until then, here is the <strong>same recipe on a blind test</strong>: the 5–6 November forecast, made before those readings existed, against what actually happened at ${s.short}.`;
    const u = D.skill.unseen.hourly[id].map(r => ({ t: IST(r[0]), base: r[1], lo: r[2], hi: r[3], y: r[4] }));
    const { g, w, h } = frame('#fcChart'); const x = d3.scaleTime().domain(d3.extent(u, d => d.t)).range([0, w]);
    const y = d3.scaleLinear().domain([0, d3.max(u, d => Math.max(d.hi, d.y || 0)) * 1.1]).nice().range([h, 0]);
    bands(g, y, w); yAxis(g, y, w, 'µg/m³'); timeAxis(g, x, h, w);
    g.append('path').datum(u).attr('d', d3.area().x(d => x(d.t)).y0(d => y(d.lo)).y1(d => y(d.hi)).curve(d3.curveMonotoneX)).attr('fill', C('base')).attr('opacity', .2);
    g.append('path').datum(u).attr('d', d3.line().x(d => x(d.t)).y(d => y(d.base)).curve(d3.curveMonotoneX)).attr('fill', 'none').attr('stroke', C('base')).attr('stroke-width', 2.4);
    g.append('path').datum(u).attr('d', d3.line().defined(d => d.y != null).x(d => x(d.t)).y(d => y(d.y))).attr('fill', 'none').attr('stroke', C('actual')).attr('stroke-width', 1.6);
    hover(g, x, w, h, u, r => `<b>${d3.timeFormat('%a %d %b %H:00')(r.t)}</b><br>actual ${fmt(r.y)}<br>forecast ${fmt(r.base)} (band ${fmt(r.lo)}–${fmt(r.hi)})`);
    legend('#fcLegend', [['actual', 'What actually happened'], ['base', 'Forecast (made 7 Nov)'], ['base', 'Band ×0.85–×1.15', true]]);
    const R = D.skill.unseen.rmse, B = D.skill.unseen.bias;
    $('#fcCallouts').innerHTML = callouts([['Error, centre line', fmt(R.base, 1), `RMSE µg/m³ · bias ${fmt(B.base, 1)}`], ['Error, high version', fmt(R.hi, 1), `RMSE · bias ${fmt(B.hi, 1)} — ${fmt(100 * (1 - R.hi / R.base))}% better`], ['Error, low version', fmt(R.lo, 1), 'RMSE · insurance for clean-air days'], ['Status', 'Pending', 'final forecast arrives 10 Nov']]);
  }
}
function ribbon(rows) {
  const el = $('#fcRibbon'); if (!el) return; const days = d3.groups(rows, r => d3.timeFormat('%a %d %b')(r.t));
  el.innerHTML = `<div class="rib-head"><span>Hour by hour</span><span class="rib-key">top row: expected · bottom row: if smoke lingers</span></div>` + days.map(([d, rs]) => `<div class="rib-day"><div class="rib-label">${d}</div><div class="rib-rows">` +
    ['base', 'hi'].map(k => `<div class="rib-row">${rs.map(r => `<i style="background:${bandColor(r[k])}" data-t="${d3.timeFormat('%a %H:00')(r.t)}" data-v="${fmt(r[k])}" data-b="${band(r[k])[1]}" data-k="${k === 'base' ? 'expected' : 'if smoke lingers'}"></i>`).join('')}</div>`).join('') +
    `<div class="rib-hours">${rs.map(r => `<span>${r.t.getHours() % 6 === 0 ? d3.timeFormat('%H')(r.t) : ''}</span>`).join('')}</div></div></div>`).join('');
  el.querySelectorAll('i').forEach(c => { c.onmousemove = e => showTip(e, `<b>${c.dataset.t}</b><br>${c.dataset.k}: ${c.dataset.v} µg/m³<br>${c.dataset.b}`); c.onmouseleave = hideTip; });
}
function bands(g, y, w, labels = true) { const top = y.domain()[1]; let lo = 0;
  CPCB.forEach(([hi, name, v]) => { const a = Math.max(lo, 0), b = Math.min(hi, top); if (b > a) { g.append('rect').attr('x', 0).attr('width', w).attr('y', y(b)).attr('height', y(a) - y(b)).attr('fill', css(v)).attr('opacity', .09);
    if (labels && y(a) - y(b) > 16) g.append('text').attr('class', 'band-label').attr('x', w - 6).attr('y', y(b) + 15).attr('text-anchor', 'end').style('fill', css(v)).text(name); } lo = hi; }); }
function callouts(items) { return items.map(([k, v, p]) => `<div class="callout reveal"><div class="k">${k}</div><div class="v">${v}</div><p>${p}</p></div>`).join(''); }

/* 02 what the model knows */
function drawKnow() {
  const K = D.knows, ids = D.stations.map(s => s.id); const { g, w, h } = frame('#knowChart', { t: 30, r: 20, b: 34, l: 110 });
  const t0 = d3.timeDay.offset(IST(K.festival_start.slice(0, 16)), -3), t1 = d3.timeHour.offset(IST(K.target_start.slice(0, 16)), 48);
  const x = d3.scaleTime().domain([t0, t1]).range([0, w]), y = d3.scaleBand().domain(ids).range([0, h]).padding(.42);
  timeAxis(g, x, h, w);
  const F0 = IST(K.festival_start.slice(0, 16)), O = IST(K.origin.slice(0, 16)), S0 = IST(K.target_start.slice(0, 16));
  const zone = (a, b, fill, op, label) => { g.append('rect').attr('x', x(a)).attr('width', Math.max(0, x(b) - x(a))).attr('y', -18).attr('height', h + 18).attr('fill', fill).attr('opacity', op);
    if (label) g.append('text').attr('x', x(a) + 6).attr('y', -6).text(label); };
  zone(F0, O, css('--amber'), .08, 'festival days: readings capped'); zone(S0, t1, css('--teal'), .1, 'target 11–12 Nov');
  ids.forEach(id => { const s = K.stations[id], yy = y(id), bh = y.bandwidth(); const kept = IST(s.newest_kept.slice(0, 16)), last = IST(s.latest.slice(0, 16));
    g.append('text').attr('x', -10).attr('y', yy + bh / 2 + 4).attr('text-anchor', 'end').style('fill', css('--text')).style('font-family', 'var(--sans)').style('font-size', '13px').text(ST[id].short);
    g.append('rect').attr('x', 0).attr('width', x(F0)).attr('y', yy).attr('height', bh).attr('rx', 4).attr('fill', css('--teal')).attr('opacity', .85);
    g.append('rect').attr('x', x(F0)).attr('width', Math.max(0, x(O) - x(F0))).attr('y', yy).attr('height', bh).attr('fill', css('--amber')).attr('opacity', .55);
    g.append('text').attr('x', (x(F0) + x(O)) / 2).attr('y', yy + bh / 2 + 4).attr('text-anchor', 'middle').style('fill', css('--text')).text(`${s.capped} of ${s.fest_hours} h capped at ${fmt(s.cap)}`);
    if (last > O) g.append('rect').attr('x', x(O)).attr('width', x(last) - x(O)).attr('y', yy + bh * .25).attr('height', bh * .5).attr('fill', css('--fog')).attr('opacity', .55);
    g.append('line').attr('x1', x(O)).attr('x2', x(S0)).attr('y1', yy + bh + 7).attr('y2', yy + bh + 7).attr('stroke', css('--vpoor')).attr('stroke-width', 1.5).attr('marker-end', 'url(#arr)');
    g.append('rect').attr('x', 0).attr('width', w).attr('y', yy).attr('height', bh).attr('fill', 'transparent').on('mousemove', e => showTip(e, `<b>${ST[id].short}</b><br>latest reading ${s.latest.slice(0, 16)}<br>festival hours ${s.fest_hours} (median ${fmt(s.fest_median)}, max ${fmt(s.fest_max)})<br>capped at ${fmt(s.cap)} µg/m³: ${s.capped} hours<br>not used, after the origin: ${s.dropped_after_origin} hours (mean ${fmt(s.after_origin_mean)})`)).on('mouseleave', hideTip);
  });
  g.append('line').attr('x1', x(O)).attr('x2', x(O)).attr('y1', -18).attr('y2', h).attr('stroke', css('--text')).attr('stroke-dasharray', '2 3');
  g.append('text').attr('x', x(O) + 4).attr('y', h - 4).text(`forecast origin · ${K.gap_h} h before the target`);
  g.append('defs').append('marker').attr('id', 'arr').attr('viewBox', '0 0 10 10').attr('refX', 9).attr('refY', 5).attr('markerWidth', 6).attr('markerHeight', 6).attr('orient', 'auto').append('path').attr('d', 'M0,0L10,5L0,10z').attr('fill', css('--vpoor'));
  const st = Object.values(K.stations);
  $('#knowFacts').innerHTML = [['Forecast lead', `${K.gap_h} h`, 'from the forecast origin to the first target hour'], ['Fireworks hours capped', `${d3.sum(st, s => s.capped)} of ${d3.sum(st, s => s.fest_hours)}`, 'kept in the data, but limited to 1.25× each station’s normal level'],
    ['Highest festival hour', fmt(d3.max(st, s => s.fest_max)), 'µg/m³ — what the cap protects the forecast from'], ['Newest hours not used', d3.sum(st, s => s.dropped_after_origin), `station-hours after the origin (mean ${fmt(d3.mean(st, s => s.after_origin_mean))} µg/m³) — tested, see Method`]]
    .map(([k, v, p]) => `<div class="fact reveal"><div class="k">${k}</div><div class="v">${v}</div><p>${p}</p></div>`).join(''); watch();
}

/* 03 skill */
function drawSkill() {
  const R = D.skill.routes[state.route], per = R.per_window.map(p => ({ ...p, t: new Date(p.S) }));
  const { g, w, h } = frame('#skillChart', { t: 30, r: 16, b: 40, l: 52 });
  const vals = per.flatMap(p => [p.rule, p.model, p.pair]).sort(d3.ascending), top = Math.ceil(Math.min(d3.max(vals), d3.quantile(vals, .9) * 1.6) / 10) * 10;
  const x = d3.scalePoint().domain(per.map(p => p.S)).range([0, w]).padding(.5), y = d3.scaleLinear().domain([0, top]).range([h, 0]).clamp(true);
  yAxis(g, y, w, 'error per window (RMSE, µg/m³) · lower is better');
  g.append('g').attr('transform', `translate(0,${h})`).call(d3.axisBottom(x).tickValues(per.filter((p, i) => i % 3 === 0).map(p => p.S)).tickFormat(s => d3.timeFormat('%b %y')(new Date(s)))).call(a => a.select('.domain').remove());
  [['rule', 2, '5 4'], ['model', 3, null], ['pair', 3, null]].forEach(([k, sw, da]) => {
    g.append('path').datum(per).attr('d', d3.line().x(p => x(p.S)).y(p => y(p[k]))).attr('fill', 'none').attr('stroke', C(k)).attr('stroke-width', sw).attr('stroke-dasharray', da);
    g.selectAll(null).data(per).join('circle').attr('cx', p => x(p.S)).attr('cy', p => y(p[k])).attr('r', k === 'rule' ? 3 : 4).attr('fill', k === 'rule' ? css('--card') : C(k)).attr('stroke', C(k)).attr('stroke-width', 1.5); });
  per.filter(p => p.model > top).forEach(p => g.append('text').attr('class', 'off-label').attr('x', x(p.S) + 8).attr('y', 14).text(`↑ off scale: ${fmt(p.model)}`));
  g.append('rect').attr('width', w).attr('height', h).attr('fill', 'transparent').on('mousemove', e => { const mx = d3.pointer(e)[0], p = per[d3.minIndex(per, q => Math.abs(x(q.S) - mx))];
    showTip(e, `<b>window starting ${p.S}</b><br>baseline ${p.rule}<br>model ${p.model}<br>best of two files (×0.85, ×1.15) ${p.pair}<br>actual mean ${p.actual_mean} µg/m³`); }).on('mouseleave', hideTip);
  legend('#skillLegend', [['rule', 'Baseline (recent level + daily cycle)'], ['model', 'AirPulse model'], ['pair', 'Best of two files (×0.85 and ×1.15)']]);
  const imp = 100 * (1 - R.model_mean / R.rule_mean), pimp = 100 * (1 - R.pair_mean / R.model_mean);
  $('#skillStats').innerHTML = [['Beats the baseline', `${R.wins_vs_rule}/${R.windows}`, `windows · mean error ${fmt(imp, 1)}% lower (${R.model_mean} vs ${R.rule_mean})`],
    ['Two files beat one', `${R.pair_wins_vs_model}/${R.windows}`, `windows · ${fmt(pimp, 1)}% lower error when the better of two files counts`], ['Typical bias', `${fmt(R.bias, 1)}`, 'µg/m³ — the model runs low on average, so our second file leans high'],
    ['Honest caveat', `${R.model} vs ${R.rule}`, 'model vs baseline, pooled over every hour: a few festival spikes dominate that number, and nobody predicts those']]
    .map(([k, v, p], i) => `<div class="stat reveal" style="--d:${.06 * i}s"><div class="k">${k}</div><div class="v ${i < 2 ? 'up' : ''}">${v}</div><p>${p}</p></div>`).join(''); watch();
}
function drawDiwaliTests() {
  const el = $('#diwaliTests'); if (!el || !D.skill.diwali) return; const L = D.skill.diwali.lgbm, B = D.skill.diwali.baseline;
  const row = (name, flat, night, note) => { const g = 100 * (1 - night / flat); return `<tr><td>${name}</td><td>${fmt(flat, 2)}</td><td>${fmt(night, 2)}</td><td class="${g > .5 ? 'up' : g < -.5 ? 'down' : ''}">${g > .5 ? '−' + fmt(g, 1) + '%' : g < -.5 ? '+' + fmt(-g, 1) + '%' : 'same'}</td><td>${note}</td></tr>`; };
  el.innerHTML = `<table class="tests"><thead><tr><th>Past Diwali</th><th>Flat ×1.15 pair</th><th>Smoky-nights pair</th><th>Error change</th><th>What the air did</th></tr></thead><tbody>` +
    row('2019 · LightGBM', L['2019'].pair_flat, L['2019'].pair_night, 'dry; smoky first night') + row('2024 · LightGBM', L['2024'].pair_flat, L['2024'].pair_night, 'dry; level stayed high') + row('2025 · LightGBM', L['2025'].pair_flat, L['2025'].pair_night, 'rain washed the air') +
    row('2019 · simple baseline', B['baseline 2019'].pair_A, B['baseline 2019'].pair_R, '') + row('2024 · simple baseline', B['baseline 2024'].pair_A, B['baseline 2024'].pair_R, '') + row('2025 · simple baseline', B['baseline 2025'].pair_A, B['baseline 2025'].pair_R, '') +
    row('2021 · one station', B['baseline 2021 (11606)'].pair_A, B['baseline 2021 (11606)'].pair_R, 'cleaner than before Diwali') + `</tbody></table>`;
}
function drawUnseen() {
  const U = D.skill.unseen; const { g, w, h } = frame('#unseenChart', { t: 14, r: 16, b: 34, l: 46 });
  const ids = D.stations.map(s => s.id); const byT = {};
  ids.forEach(id => U.hourly[id].forEach(r => { const k = r[0]; (byT[k] ||= { t: IST(k), base: [], lo: [], hi: [], y: [] }); ['base', 'lo', 'hi'].forEach((c, j) => byT[k][c].push(r[j + 1])); if (r[4] != null) byT[k].y.push(r[4]); }));
  const rows = Object.values(byT).sort((a, b) => a.t - b.t).map(r => ({ t: r.t, base: d3.mean(r.base), lo: d3.mean(r.lo), hi: d3.mean(r.hi), y: r.y.length ? d3.mean(r.y) : null }));
  const x = d3.scaleTime().domain(d3.extent(rows, r => r.t)).range([0, w]), y = d3.scaleLinear().domain([0, d3.max(rows, r => Math.max(r.hi, r.y || 0)) * 1.1]).nice().range([h, 0]);
  yAxis(g, y, w, 'µg/m³, 4-station mean'); timeAxis(g, x, h, w);
  [['lo', .9], ['hi', .9], ['base', 2.4]].forEach(([k, sw]) => g.append('path').datum(rows).attr('d', d3.line().x(r => x(r.t)).y(r => y(r[k])).curve(d3.curveMonotoneX)).attr('fill', 'none').attr('stroke', C(k)).attr('stroke-width', sw).attr('stroke-dasharray', k === 'base' ? null : '5 4'));
  g.append('path').datum(rows).attr('d', d3.line().defined(r => r.y != null).x(r => x(r.t)).y(r => y(r.y))).attr('fill', 'none').attr('stroke', C('actual')).attr('stroke-width', 1.8);
  hover(g, x, w, h, rows, r => `<b>${d3.timeFormat('%a %d %b %H:00')(r.t)}</b><br>actual ${fmt(r.y)}<br>centre ${fmt(r.base)} · low ${fmt(r.lo)} · high ${fmt(r.hi)}`);
  legend('#unseenLegend', [['actual', `Actual`], ['base', `Centre (RMSE ${U.rmse.base})`], ['hi', `High ×1.15 (RMSE ${U.rmse.hi})`], ['lo', `Low ×0.85 (RMSE ${U.rmse.lo})`]]);
}

/* 04 festival */
function drawFest() {
  const F = D.festival, yrs = Object.keys(F).filter(k => /^\d{4}$/.test(k)).sort(); const pal = { '2019': css('--violet'), '2024': css('--teal'), '2025': css('--amber'), '2026': css('--text') };
  const { g, w, h } = frame('#festChart', { t: 20, r: 20, b: 36, l: 46 });
  const x = d3.scaleLinear().domain([-10, 6]).range([0, w]), y = d3.scaleLinear().domain([0, d3.max(yrs.flatMap(k => F[k].daily.map(d => d[1]))) * 1.1]).nice().range([h, 0]);
  yAxis(g, y, w, 'daily mean µg/m³'); g.append('g').attr('transform', `translate(0,${h})`).call(d3.axisBottom(x).ticks(16).tickFormat(d => d === 0 ? 'Lakshmi Puja' : (d > 0 ? '+' : '') + d + 'd')).call(a => a.select('.domain').remove());
  g.append('rect').attr('x', x(-2)).attr('width', x(3) - x(-2)).attr('y', 0).attr('height', h).attr('fill', css('--amber')).attr('opacity', .06);
  g.append('rect').attr('x', x(3)).attr('width', x(5) - x(3)).attr('y', 0).attr('height', h).attr('fill', css('--teal')).attr('opacity', .08);
  g.append('text').attr('x', x(-2) + 4).attr('y', 12).text('festival days'); g.append('text').attr('x', x(3) + 4).attr('y', 12).text('days we forecast');
  yrs.forEach(k => { const have = new Map(F[k].daily.filter(r => r[2] >= 12).map(r => [r[0], r])); const d = d3.range(-10, 7).map(i => have.get(i) || [i, null, 0]).filter(r => r[0] <= d3.max([...have.keys()]));
    g.append('path').datum(d).attr('d', d3.line().defined(r => r[1] != null).x(r => x(r[0] + .5)).y(r => y(r[1])).curve(d3.curveMonotoneX)).attr('fill', 'none').attr('stroke', pal[k]).attr('stroke-width', k === '2026' ? 3 : 2).attr('stroke-dasharray', k === '2026' ? null : null);
    g.selectAll(null).data(d.filter(r => r[1] != null)).join('circle').attr('cx', r => x(r[0] + .5)).attr('cy', r => y(r[1])).attr('r', 3.5).attr('fill', pal[k]).on('mousemove', (e, r) => showTip(e, `<b>Diwali ${k}</b> · day ${r[0] >= 0 ? '+' : ''}${r[0]}<br>${fmt(r[1])} µg/m³ (${r[2]} readings)<br>${F[k].source}`)).on('mouseleave', hideTip); });
  $('#festLegend').innerHTML = yrs.map(k => `<span><i style="background:${pal[k]}"></i>${k} · ${F[k].series} series</span>`).join('');
  $('#festFacts').innerHTML = yrs.map(k => { const d = F[k].daily, m = (a, b) => d3.mean(d.filter(r => r[0] >= a && r[0] <= b && r[2] >= 12), r => r[1]); const pre = m(-9, -3), post = m(3, 4);
    return `<div class="fact reveal"><div class="k">Diwali ${k}</div><div class="v">${post ? (post / pre).toFixed(2) + '×' : '—'}</div><p>${post ? `after vs before: ${fmt(pre)} → ${fmt(post)} µg/m³` : 'after-festival days not yet observed'} · peak hour ${F[k].peak_hour ? fmt(F[k].peak_hour[1]) : '–'}</p></div>`; }).join(''); watch();
}

function drawNight() {
  const N = D.festival.night; if (!N || !$('#nightChart')) return; const { g, w, h } = frame('#nightChart', { t: 20, r: 20, b: 36, l: 46 });
  const hrs = d3.range(48), x = d3.scaleLinear().domain([0, 47]).range([0, w]), y = d3.scaleLinear().domain([0, 3.5]).range([h, 0]).clamp(true);
  yAxis(g, y, w, '× the normal level for that hour (1 = normal)'); g.append('g').attr('transform', `translate(0,${h})`).call(d3.axisBottom(x).tickValues(d3.range(0, 48, 6)).tickFormat(i => (i < 24 ? 'day 3 · ' : 'day 4 · ') + String(i % 24).padStart(2, '0') + 'h')).call(a => a.select('.domain').remove());
  g.append('line').attr('x1', 0).attr('x2', w).attr('y1', y(1)).attr('y2', y(1)).attr('stroke', css('--fog')).attr('stroke-dasharray', '3 3');
  [[0, 6], [24, 30]].forEach(([a, b]) => g.append('rect').attr('x', x(a)).attr('width', x(b) - x(a)).attr('y', 0).attr('height', h).attr('fill', css('--violet')).attr('opacity', .07));
  g.append('text').attr('x', x(0) + 4).attr('y', 12).text('night');
  const pal = { '2019': css('--violet'), '2024': css('--teal') }, line = d3.line().defined(d => d != null).x((d, i) => x(i)).y(d => y(d)).curve(d3.curveMonotoneX);
  Object.keys(N.years).forEach(k => g.append('path').datum(N.years[k]).attr('d', line).attr('fill', 'none').attr('stroke', pal[k]).attr('stroke-width', 1.8).attr('opacity', .8));
  g.append('path').datum(N.used).attr('d', line).attr('fill', 'none').attr('stroke', css('--vpoor')).attr('stroke-width', 3);
  const rows = hrs.map(i => ({ t: i, a: N.years['2019'][i], b: N.years['2024'][i], u: N.used[i] }));
  g.append('rect').attr('width', w).attr('height', h).attr('fill', 'transparent').on('mousemove', e => { const i = Math.max(0, Math.min(47, Math.round(x.invert(d3.pointer(e)[0])))), r = rows[i];
    showTip(e, `<b>day ${i < 24 ? 3 : 4} after Lakshmi Puja · ${String(i % 24).padStart(2, '0')}:00</b><br>2019: ${fmt(r.a, 2)}× normal<br>2024: ${fmt(r.b, 2)}× normal<br>used in our smoky-nights file: ${fmt(r.u, 2)}×`); }).on('mouseleave', hideTip);
  $('#nightLegend').innerHTML = `<span><i style="background:${pal['2019']}"></i>Diwali 2019 (10 stations)</span><span><i style="background:${pal['2024']}"></i>Diwali 2024 (23 stations)</span><span><i style="background:${css('--vpoor')}"></i>Uplift we submitted (cautious: square root of the average)</span>`;
  const o = N.observed_2026 || [], n2 = o.filter(r => r[0] >= 48 && r[0] < 56).map(r => r[1]);
  $('#nightFacts').innerHTML = [['First night, 2019', fmt(d3.mean(N.years['2019'].slice(0, 5)), 1) + '×', 'midnight to 5 am, three days after Lakshmi Puja'], ['First night, 2024', fmt(d3.mean(N.years['2024'].slice(0, 5)), 1) + '×', 'same hours — the smoke outlasts the fireworks'],
    ['What we assume for 2026', fmt(d3.mean(N.used.slice(0, 5)), 1) + '×', 'deliberately below both years: three or four Diwalis is thin evidence'], ['Seen so far in 2026', n2.length ? fmt(d3.median(n2), 1) + '×' : '—', 'night of 10 Nov, two days after Lakshmi Puja (median of four stations)']]
    .map(([k, v, p]) => `<div class="fact reveal"><div class="k">${k}</div><div class="v">${v}</div><p>${p}</p></div>`).join(''); watch();
}

/* 05 weather */
function drawWeather() {
  const W = D.weather, id = state.wx; const rows = W.stations[id].map(r => ({ t: IST(r[0]), ws: r[1], dir: r[2], hpbl: r[3], vent: r[4], rain: r[5], temp: r[6], rh: r[7] }));
  const { g, w, h } = frame('#wxChart', { t: 20, r: 50, b: 34, l: 54 });
  const x = d3.scaleTime().domain(d3.extent(rows, r => r.t)).range([0, w]), y = d3.scaleLinear().domain([0, d3.max(rows, r => r.vent) * 1.1]).nice().range([h, 0]);
  const y2 = d3.scaleLinear().domain([0, Math.max(8, d3.max(rows, r => r.ws) * 1.2)]).range([h, 0]);
  yAxis(g, y, w, 'ventilation m²/s'); timeAxis(g, x, h, w);
  g.append('g').attr('transform', `translate(${w},0)`).call(d3.axisRight(y2).ticks(4)).call(a => a.select('.domain').remove()).append('text').attr('x', 0).attr('y', -6).attr('text-anchor', 'end').text('wind m/s');
  const S0 = IST(D.knows.target_start.slice(0, 16)); g.append('rect').attr('x', x(S0)).attr('width', Math.max(0, x(d3.timeHour.offset(S0, 48)) - x(S0))).attr('height', h).attr('fill', css('--teal')).attr('opacity', .08);
  const stag = 1500; g.append('line').attr('x1', 0).attr('x2', w).attr('y1', y(stag)).attr('y2', y(stag)).attr('stroke', css('--vpoor')).attr('stroke-dasharray', '4 4'); g.append('text').attr('x', 4).attr('y', y(stag) - 4).style('fill', css('--vpoor')).text('stagnant below ~1,500');
  g.append('path').datum(rows).attr('d', d3.area().x(r => x(r.t)).y0(h).y1(r => y(r.vent)).curve(d3.curveMonotoneX)).attr('fill', css('--violet')).attr('opacity', .3);
  g.append('path').datum(rows).attr('d', d3.line().x(r => x(r.t)).y(r => y2(r.ws)).curve(d3.curveMonotoneX)).attr('fill', 'none').attr('stroke', css('--teal')).attr('stroke-width', 2);
  g.selectAll(null).data(rows.filter(r => r.rain > .05)).join('rect').attr('x', r => x(r.t) - 3).attr('width', 6).attr('y', r => h - Math.min(h, r.rain * 30)).attr('height', r => Math.min(h, r.rain * 30)).attr('fill', '#6fa8ff');
  hover(g, x, w, h, rows, r => `<b>${d3.timeFormat('%a %d %b %H:00')(r.t)}</b><br>ventilation ${fmt(r.vent)} m²/s<br>wind ${fmt(r.ws, 1)} m/s from ${fmt(r.dir)}°<br>mixing height ${fmt(r.hpbl)} m<br>rain ${fmt(r.rain, 2)} mm/h · ${fmt(r.temp, 1)}°C · RH ${fmt(r.rh)}%`);
  $('#wxLegend').innerHTML = `<span><i class="box" style="background:${css('--violet')}"></i>Ventilation</span><span><i style="background:${css('--teal')}"></i>Wind speed</span><span><i style="background:#6fa8ff"></i>Rain</span><span>GFS run ${W.cycle.slice(0, 13).replace('T', ' ')}Z · ${W.source}</span>`;
  const tw = rows.filter(r => r.t >= S0 && r.t < d3.timeHour.offset(S0, 48)), before = rows.filter(r => r.t < S0);
  const cover = tw.length ? `${tw.length} forecast steps` : 'beyond this run — newer run on 10 Nov';
  $('#wxCallouts').innerHTML = callouts([['Ventilation, 11–12 Nov', tw.length ? fmt(d3.mean(tw, r => r.vent)) : '—', `m²/s · ${cover}`], ['Days before', fmt(d3.mean(before, r => r.vent)), 'm²/s average in this run'],
    ['Stagnant steps', tw.length ? `${tw.filter(r => r.vent < stag).length}/${tw.length}` : '—', 'below ~1,500 m²/s during the target days'], ['Rain, 11–12 Nov', tw.length ? fmt(d3.sum(tw, r => r.rain * 3), 1) + ' mm' : '—', 'dry air keeps pollution in place']]);
}

/* 06 health */
function drawHealth() {
  const H = D.health, ids = D.stations.map(s => s.id); const months = [...new Set(ids.flatMap(id => Object.keys(H[id].monthly_coverage)))].sort();
  const { g, w, h } = frame('#healthChart', { t: 10, r: 10, b: 40, l: 110 }); const x = d3.scaleBand().domain(months).range([0, w]).padding(.08), y = d3.scaleBand().domain(ids).range([0, h]).padding(.12);
  const cls = v => v == null ? [css('--ink-3'), 'no data'] : v >= 90 ? [css('--good'), '90%+'] : v >= 75 ? [css('--sat'), '75–90%'] : v >= 50 ? [css('--mod'), '50–75%'] : [css('--vpoor'), 'under 50%'];
  ids.forEach(id => { g.append('text').attr('x', -10).attr('y', y(id) + y.bandwidth() / 2 + 5).attr('text-anchor', 'end').style('fill', css('--text')).style('font-size', '14px').text(ST[id].short);
    months.forEach(m => { const v = H[id].monthly_coverage[m], [c] = cls(v); g.append('rect').attr('x', x(m)).attr('y', y(id)).attr('width', x.bandwidth()).attr('height', y.bandwidth()).attr('rx', 4).attr('fill', c).attr('opacity', v == null ? .5 : .85)
      .on('mousemove', e => showTip(e, `<b>${ST[id].short}</b> · ${m}<br>${v == null ? 'no data' : v + '% of hours reported'}`)).on('mouseleave', hideTip);
      if (v != null && x.bandwidth() > 30) g.append('text').attr('class', 'cell-label').attr('x', x(m) + x.bandwidth() / 2).attr('y', y(id) + y.bandwidth() / 2 + 5).attr('text-anchor', 'middle').text(Math.round(v)); }); });
  $('#healthLegend').innerHTML = [95, 80, 60, 30].map(v => `<span><i class="box" style="background:${cls(v)[0]};opacity:.85"></i>${cls(v)[1]} of hours reported</span>`).join('');
  g.append('g').attr('transform', `translate(0,${h})`).call(d3.axisBottom(x).tickValues(months.filter((m, i) => i % 2 === 0)).tickFormat(m => d3.timeFormat('%b %y')(new Date(m + '-01')))).call(a => a.select('.domain').remove());
  $('#healthCards').innerHTML = ids.map(id => { const s = H[id]; const flags = [];
    if (s.over_1000) flags.push(`${s.over_1000} readings above 1,000 µg/m³ (max ${fmt(s.max)}) — physically implausible, excluded`);
    if (s.longest_gap_h > 48) flags.push(`longest outage ${s.longest_gap_h} h`);
    if (s.stuck_runs_6h) flags.push(`${s.stuck_runs_6h} runs of 6+ identical hourly values`);
    return `<div class="hc reveal"><h3>${ST[id].short}</h3><dl><dt>Coverage</dt><dd>${s.coverage}%</dd><dt>Readings</dt><dd>${s.hours.toLocaleString()}</dd><dt>Gaps over a day</dt><dd>${s.gaps_over_24h}</dd><dt>Longest gap</dt><dd>${s.longest_gap_h} h</dd><dt>Since</dt><dd>${s.first.slice(0, 10)}</dd></dl>${flags.map(f => `<div class="flag">${f}</div>`).join('')}</div>`; }).join(''); watch();
}
})();
