"""Daily air brief written by Google Gemini, in English, Hindi and Marathi.

Reads site/data/city.json (the forecast this run just built), picks today and tomorrow (IST), computes a few facts
(population-weighted city average, cleanest daytime hour, worst hour, most affected wards) and asks Gemini to turn
ONLY those facts into a short brief. The reply is rejected if it contains any number that is not in the facts,
so the model cannot invent values. Writes site/data/brief.json.

Runs in the cloud job after the forecast. Needs the GitHub secret GEMINI_API_KEY; without it the step is skipped
and the app simply does not show the brief. Standard library only.
"""
import json, os, re, sys, time, urllib.request
from datetime import datetime, timedelta, timezone

MODEL = os.environ.get('GEMINI_MODEL', '')   # empty: pick the newest Flash model this key can use
KEY = os.environ.get('GEMINI_API_KEY', '').strip()
from pathlib import Path
D_ = Path(__file__).resolve().parents[1] / 'site' / 'data'
CITY, OUT = D_ / 'city.json', D_ / 'brief.json'
CUT = [30, 60, 90, 120, 250, 1e9]
CAT = ['Good', 'Satisfactory', 'Moderate', 'Poor', 'Very poor', 'Severe']
cat = lambda v: CAT[next(i for i, c in enumerate(CUT) if v <= c)]


def facts():
    d = json.load(open(CITY, encoding='utf-8'))
    H, W = d['hours'], d['wards']
    pop = sum(w['pop'] for w in W)
    today = (datetime.now(timezone.utc) + timedelta(hours=5, minutes=30)).date()
    days = []
    for day in (today, today + timedelta(days=1)):
        iso = day.isoformat()
        ks = [k for k, h in enumerate(H) if h[:10] == iso]
        if len(ks) < 24:
            continue
        city = {k: sum(w['base'][k] * w['pop'] for w in W) / pop for k in ks}
        city_hi = {k: sum(w['hi'][k] * w['pop'] for w in W) / pop for k in ks}
        day_ks = [k for k in ks if 6 <= int(H[k][11:13]) <= 21]
        best = min(day_ks, key=city.get)
        worst = max(ks, key=city_hi.get)
        wards = sorted(W, key=lambda w: -sum(w['base'][k] for k in ks))[:3]
        mean = sum(city.values()) / 24
        days.append({
            'date': iso, 'label': day.strftime('%A %d %B'),
            'city_average_ugm3': round(mean), 'city_average_category': cat(mean),
            'cleanest_daytime_hour': H[best][11:16], 'cleanest_hour_ugm3': round(city[best]),
            'worst_hour': H[worst][11:16], 'worst_hour_ugm3_if_smoke_lingers': round(city_hi[worst]),
            'most_affected_wards': [w['area'] for w in wards],
            'kind': 'measured and forecast' if 'm' in d['kind'][ks[0]:ks[-1] + 1] else 'forecast'})
    return {'city': 'Mumbai', 'pollutant': 'PM2.5 (µg/m³), CPCB categories', 'days': days}


PROMPT = """You write the daily air-quality brief for Mumbai AirPulse, read by ordinary residents of all ages.
Use ONLY the facts in the JSON below. Do not add any other number, date, place or claim. Do not give medical advice
beyond suggesting that children, elderly people and people with heart or lung conditions limit outdoor effort when the
air is Moderate or worse. Plain sentences, no emoji, no hashtags, no markdown. At most 55 words per language.
Write numbers with Western digits (0-9) in all three languages and times as HH:MM, exactly as in the facts.
Keep ward names in English. In Hindi and Marathi, write everything else in Hindi or Marathi words: weekday and month
(e.g. Wednesday 11 November = बुधवार 11 नवंबर in Hindi, बुधवार 11 नोव्हेंबर in Marathi), the city (मुंबई), and the
air category using these words: Good = अच्छी / चांगली, Satisfactory = संतोषजनक / समाधानकारक, Moderate = मध्यम / मध्यम,
Poor = खराब / वाईट, Very poor = बहुत खराब / खूप वाईट, Severe = गंभीर / गंभीर (Hindi / Marathi).

Return JSON with keys "en" (English), "hi" (Hindi, Devanagari) and "mr" (Marathi, Devanagari).

FACTS:
"""


def pick_model():
    """Ask the Gemini API which models this key can use; prefer the newest plain Flash model (text generation)."""
    req = urllib.request.Request('https://generativelanguage.googleapis.com/v1beta/models?pageSize=200', headers={'x-goog-api-key': KEY})
    with urllib.request.urlopen(req, timeout=30) as r:
        ms = json.load(r).get('models', [])
    ok = [m['name'].split('/')[-1] for m in ms if 'generateContent' in m.get('supportedGenerationMethods', [])]
    skip = ('lite', 'image', 'tts', 'live', 'audio', 'vision', 'embedding', 'thinking', 'learnlm', 'exp', 'preview')
    flash = [n for n in ok if n.startswith('gemini') and 'flash' in n and not any(x in n for x in skip)]
    ver = lambda n: tuple(int(x) for x in re.findall(r'\d+', n.split('flash')[0])) or (0,)
    pool = flash or [n for n in ok if n.startswith('gemini') and 'flash' in n] or [n for n in ok if n.startswith('gemini')]
    if not pool:
        raise RuntimeError('no Gemini text model available for this key')
    return sorted(set(pool), key=lambda n: (ver(n), -len(n)), reverse=True)[:3]   # newest first; next ones are fallbacks


def ask(f, model):
    body = {'contents': [{'parts': [{'text': PROMPT + json.dumps(f, ensure_ascii=False)}]}],
            'generationConfig': {'temperature': 0.2, 'responseMimeType': 'application/json',
                                 'responseSchema': {'type': 'OBJECT', 'properties': {k: {'type': 'STRING'} for k in ('en', 'hi', 'mr')},
                                                    'required': ['en', 'hi', 'mr']}}}
    req = urllib.request.Request(f'https://generativelanguage.googleapis.com/v1beta/models/{model}:generateContent',
                                 data=json.dumps(body).encode(), headers={'Content-Type': 'application/json', 'x-goog-api-key': KEY})
    with urllib.request.urlopen(req, timeout=120) as r:
        res = json.load(r)
    return json.loads(res['candidates'][0]['content']['parts'][0]['text'])


def check(f, b):
    allowed = set()
    for v in re.findall(r'\d+', json.dumps(f)):
        allowed.add(v.lstrip('0') or '0')
    for lg in ('en', 'hi', 'mr'):
        t = b.get(lg, '').strip()
        if not (20 <= len(t) <= 600):
            return f'{lg}: length {len(t)}'
        if re.search(r'[०-९]', t):
            return f'{lg}: Devanagari digits'
        if lg != 'en' and not re.search(r'[ऀ-ॿ]', t):
            return f'{lg}: not in Devanagari'
        if re.search(r'[\U0001F300-\U0001FAFF☀-➿]', t):
            return f'{lg}: emoji'
        if lg != 'en' and re.search(r'\b(January|February|March|April|May|June|July|August|September|October|November|December|Good|Satisfactory|Moderate|Poor|Severe|Mumbai)\b', t):
            return f'{lg}: English words left in'
        bad = [n for n in re.findall(r'\d+', t) if (n.lstrip('0') or '0') not in allowed]
        if bad:
            return f'{lg}: numbers not in the facts {bad}'
    return None


def main():
    if not KEY:
        print('gemini brief: no GEMINI_API_KEY secret, skipped'); return
    f = facts()
    if not f['days']:
        print('gemini brief: no complete day for today or tomorrow, skipped'); return
    try:
        models = [MODEL] if MODEL else pick_model()
    except Exception as e:
        print('gemini brief: could not list models:', str(e)[:200]); return
    print('gemini brief: models to try', models)
    tries = [(m, k) for k in range(3) for m in models]   # busy model (503) or timeout: wait longer, then try the next model
    for i, (model, k) in enumerate(tries):
        try:
            b = ask(f, model)
        except Exception as e:  # network, overload or quota: keep the previous brief, never fail the forecast
            print(f'gemini brief: {model} failed:', str(e)[:160]); time.sleep(min(60, 10 * (k + 1))); continue
        why = check(f, b)
        if why is None:
            out = {'model': model, 'made': datetime.now(timezone.utc).strftime('%Y-%m-%dT%H:%MZ'),
                   'for': [d['date'] for d in f['days']], 'facts': f, **{k: b[k].strip() for k in ('en', 'hi', 'mr')}}
            json.dump(out, open(OUT, 'w', encoding='utf-8'), ensure_ascii=False, indent=1)
            print('gemini brief: written for', out['for']); return
        print(f'gemini brief: {model} reply rejected (' + why + '), retrying')
    print('gemini brief: no valid brief this run; the previous one stays')


if __name__ == '__main__':
    main(); sys.exit(0)
