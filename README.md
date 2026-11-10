# AirPulse Mumbai

**Tomorrow's air for every Mumbai ward: when to go out, who is exposed, and how far to trust it.**

Built by team **Kryptonite** for the Google Mumbai Data Challenge 2026 (Zindi), creative-submission category.

## Live app: **https://airpulse-mumbai-2026.web.app**

| Open directly in | Link |
|---|---|
| English | https://airpulse-mumbai-2026.web.app/?lang=en |
| हिंदी (Hindi) | https://airpulse-mumbai-2026.web.app/?lang=hi |
| मराठी (Marathi) | https://airpulse-mumbai-2026.web.app/?lang=mr |
| A specific ward, e.g. Govandi · Mankhurd at 1 am | https://airpulse-mumbai-2026.web.app/?ward=ME&hour=1 |
| Full evidence dashboard | https://airpulse-mumbai-2026.web.app/evidence/ |

Works on any phone browser; no install, no sign-in.

Air-quality apps usually show one number for one station. AirPulse turns a forecast for four official stations into something every family in Mumbai can use: a forecast for all 24 BMC wards, a plan for your day, and a picture to send to the family WhatsApp group, in English, Hindi or Marathi.

## What it does

A white, single-page dashboard (DM Sans; Noto Sans Devanagari for Hindi and Marathi). Pick an area, a day and an hour at the top; every panel updates. The control bar stays at the top of the screen as you scroll, in a compact form so it never hides a section heading. The area you pick is also your home area in *My exposure*, and changing either one changes both.

| Panel | What you get |
|---|---|
| **Controls** | Area (24 BMC wards, or "use my location"), day strip with arrows (always starts on a whole day), hour slider with play-through |
| **Key numbers** | PM2.5 at the chosen hour with its CPCB category and the smoky-nights value, day average, cigarette equivalent (Berkeley Earth: 22 µg/m³ over 24 h ≈ 1 cigarette), cleanest hour, worst hour |
| **Hour by hour** | Chart of the expected PM2.5 and the higher path if Diwali smoke lingers, on the CPCB colour bands; three days on a computer, the chosen day on a phone; click to pick an hour; read aloud with **Listen** (the button turns into **Stop** while it speaks) |
| **Who is breathing bad air** | People and school students in wards at Moderate or worse at that hour, the worst wards, and the worst moment still ahead |
| **City map** | All 24 wards coloured hour by hour; forecast and estimated stations; click a ward to select it |
| **For BMC: tonight's priority wards** | Wards ranked by people × how far and how long the air goes above 60 µg/m³, the start of Moderate (20:00–06:00, if smoke lingers), with peak and schools; CSV download for BMC's 76 ward squads |
| **Today's air brief** | A short summary of today and tomorrow in your language, written by Google Gemini from the forecast numbers (every number checked) |
| **Plan my day** | Walk, run, kids playing, commute, elderly / heart-lung, outdoor work: the cleanest hour, the hour to avoid, plain advice, and **Add to Google Calendar** |
| **My exposure, and how to cut it** | Home ward, work ward, commute times, exercise and children's outdoor time → PM2.5 breathed in outdoors (µg, US EPA breathing rates) and a cleaner plan, e.g. 250 → 200 µg (−20%) |
| **Share with family** | A picture of your area's air in your language, for WhatsApp |
| **How accurate is this?** | How the model was built and tested, linking to the full evidence dashboard (`/evidence`, which links back to the app) |

**Installable app:** on a phone, open the link and choose *Add to Home screen*. It installs as **AirPulse** with its own icon, opens full-screen, and keeps working offline from the last forecast (web app manifest + service worker).

Links can preselect language, ward and hour: `?lang=mr&ward=ME&hour=1`.

## Google tools used, and how

| Google tool | What we use it for | Where in this repo |
|---|---|---|
| **Firebase Hosting** | Serves the live app at `airpulse-mumbai-2026.web.app` over HTTPS on Google's global CDN; pages, scripts and data are served with `no-cache`, so each forecast refresh shows up at once | `firebase.json`, `.firebaserc`; deployed with `firebase deploy --only hosting` |
| **Google Cloud** | The Firebase project `airpulse-mumbai-2026` is a Google Cloud project. A hosting-only service account (IAM) lets the cloud job publish each new forecast | Firebase console → project `airpulse-mumbai-2026`; `.github/workflows/daily-forecast.yml` |
| **Google Fonts** | *DM Sans* for Latin text and *Noto Sans Devanagari* (Google's Noto family) so Hindi and Marathi render cleanly on every phone | `<link>` in `index.html` |
| **Gemini** (Gemini API, `gemini-2.5-flash`) | Writes the **daily air brief** at the top of the app in English, Hindi and Marathi, from the forecast numbers only. The cloud job rejects any reply that contains a number not in those facts, or emoji, or wrong digits, and keeps the previous brief instead; the brief shows only while it is for today or tomorrow, labelled "Google Gemini" | `cloud/gemini_brief.py` → `data/brief.json`; key kept as the encrypted secret `GEMINI_API_KEY` |
| **Google Calendar** | **Add to Google Calendar** in *Plan my day* opens a ready event for the cleanest hour of the chosen activity, in the user's language, Mumbai time zone; no sign-in to AirPulse, no key | `calUrl()` in `app.js` |
| **Google Maps** | **Open in Google Maps** on the city map opens the selected ward | `paintMap()` in `app.js` |
| **Google text-to-speech voices** (Chrome and Android, through the Web Speech API) | The **Listen** button reads the forecast, the advice and the personal plan aloud in English, Hindi or Marathi; on Android and Chrome these are Google's voices. Marathi falls back to Hindi when no Marathi voice is installed | `speak()` in `app.js` |

The forecast itself comes from our competition model (LightGBM with NOAA GFS weather). The extra city data comes from the ClimateVerse catalogue: BMC wards and population, and UDISE+ schools.

### Deploy it yourself

```bash
npm install -g firebase-tools        # or: npx firebase-tools ...
firebase login
firebase deploy --only hosting --project airpulse-mumbai-2026
```

## The timeline: last week, today, and the days ahead

| Days | What you see |
|---|---|
| **Past week** (from 4 Nov) | **Measured** PM2.5 at the four official stations (Zindi Train), spread to all 24 wards; Diwali nights included (e.g. Malad 354 µg/m³ on 8 Nov). Station outage hours are filled by the weather engine's day-before forecast and drawn in orange |
| **Today** | Measured until the last Zindi reading, then forecast; a "last reading" line marks the switch |
| **11–12 Nov** | Our submitted competition forecast |
| **Later days** | The daily weather engine, one more day with each new GFS run |

The day tabs say *Today* and *Tomorrow*, and each day says whether it is measured or forecast and which engine made it.

## Cloud backend: no laptop, no person

The application updates itself in the cloud, from `.github/workflows/daily-forecast.yml` (GitHub Actions). It runs twice a day at 11:15 and 23:30 IST, after each new NOAA GFS run is published, and can also be started by hand.

| Step | What runs | Where |
|---|---|---|
| 1. Weather | Downloads the newest NOAA GFS runs (1°, forecast hours 6–81) from the NOAA Open Data bucket on AWS and reads six fields at the four stations with ecCodes | `cloud/cloud_update.py` |
| 2. Forecast | Daily weather engine (`cloud/wx_lgbm.txt`, LightGBM); the newest run wins for every hour; history kept in `cloud/store.csv` | `cloud/cloud_update.py` |
| 3a. Brief | Google Gemini writes the daily brief from the forecast facts; replies with any number not in the facts are rejected (skipped if no key) | `cloud/gemini_brief.py` |
| 3. City | 4 → 26 stations (ridge transfer + distance weighting, `cloud/transfer.json`), then 24 wards; adds every complete new day after the fixed part (`cloud/base_city.json`: measured week + submitted 11–12 Nov forecast) | `cloud/cloud_update.py` |
| 4. Quality gate | The 71 browser checks in headless Chrome: all three languages, a computer screen and a 390 px phone screen, and the evidence page; **nothing is published if one fails** | workflow, `tests/run.html` |
| 5. Publish | Firebase Hosting (Google Cloud) through a hosting-only service account kept as the encrypted secret `FIREBASE_SERVICE_ACCOUNT` | `FirebaseExtended/action-hosting-deploy` |
| 6. Record | Commits `data/city.json`, `data/status.json` and `cloud/store.csv` back to this repository | workflow |

**Checked against the local pipeline:** the cloud's own GFS download matches the competition's weather tables exactly (624 values, difference 0.0). The cloud engine also matches the local engine exactly (348 hours, difference 0.0).

The **How AirPulse works** panel in the app shows this pipeline, with a live status line read from `data/status.json`: last update, the GFS run used, the date the forecast runs to, what ran it, and the checks passed.

## Two forecast engines

| Days | Engine | Inputs | Tested |
|---|---|---|---|
| **11–12 Nov 2026** | Our **competition model** (LightGBM blend, the exact files submitted to Zindi) | Zindi Train to 10 Nov 09:00 + NOAA GFS as issued | 28 backtest windows; past Diwalis |
| **Every later day** | The **daily weather engine** (`scripts/wx_engine.py`): LightGBM that predicts PM2.5 from the GFS forecast, hour, day of year and station; it needs no fresh PM readings, so it keeps working after the last Zindi release | NOAA GFS runs (00Z, 12Z), trained on 278,000 station-hours of Zindi Train | Out-of-time, 1 Sep – 5 Nov 2026, 1–3 days ahead: hourly RMSE **14.4** vs 18.8 for the usual level of that month and hour (−23%); daily correlation **0.75** |

The cloud job above makes the daily update. `scripts/daily_update.sh` is the earlier laptop version of the same steps; it is kept for reference and is not needed. Each day's tab says which engine made it.

## How it works

1. **Four-station forecast.** Our competition model (LightGBM, trained with NOAA GFS weather as it was issued) forecasts the four official stations for 11–12 Nov 2026, exactly as submitted to the competition.
2. **From 4 stations to 26.** A second model learned from 2024 data how 22 other Mumbai stations move with those four (ridge regression on the four stations plus time of day), blended 50/50 with a distance-weighted average. Tested two ways:
   - hold-out (16 Nov – 31 Dec 2024, 21 stations): RMSE 24.3 µg/m³ vs 29.0 for the distance average alone;
   - two years later (1–16 Oct 2026, 11 stations): 16.3 vs 16.9.
3. **Wards.** Each ward takes the distance-weighted average of all 26 stations at its centre.
4. **People.** Ward population from BMC prabhag data; school enrolment from UDISE+ 2024-25.

## Tests

`tests/run.html` opens the app and clicks through every control. It checks 71 things:

| Group | Checks |
|---|---|
| Look | white background, DM Sans, no emoji, page title |
| Data | 24 wards, the full timeline (measured days, today, forecast days), Today / Tomorrow labels, which engine made each day |
| Google links | the Google Calendar event is for the cleanest hour shown (Mumbai time), the Google Maps link opens the selected ward, the Gemini brief shows only while it is current |
| Panels | KPIs, chart (measured line, forecast line, hour picking), all 24 ward shapes and map tiles, exposure counts, BMC ranking, all six activities, the exposure planner, the share picture, five accuracy cards, the six-stage pipeline with Google tools |
| Controls | ward picker, day tabs, day-strip arrows, hour slider, play, map click; the day strip never starts on a cut-off day and always shows the chosen day |
| Linked choices | picking an area sets *I live in*, and changing *I live in* changes the area |
| Layout | the control bar turns compact when scrolled and no section heading sits under it; the last accuracy card fills its row |
| Phone (390 px, Marathi) | nothing wider than the screen, the chart shows one readable day, pipeline cards sit flat, no script errors |
| Languages | Hindi and Marathi headings, plan text and KPIs are translated; no script errors in any language |
| Evidence page | renders its charts, no emoji, a link back to the app, no script errors |

```bash
python3 -m http.server 8766          # from the repo root
# open http://localhost:8766/tests/run.html     ->   RESULT: 71 passed, 0 failed
# open http://localhost:8766/tests/phone.html   ->   the app in two phone-sized frames (English, Marathi)
```

### End-to-end test, 10 Nov 2026

Every control was also clicked by hand in a real Chrome browser on the live site, and the backend files (`data/city.json`, `data/status.json`, `evidence/`, `sw.js`, manifest) were fetched and checked. Working: day tabs, chart click and tooltip, map click, area picker, play, all activities, Listen (with Google voices for English and Hindi), Share / Download picture, BMC CSV, use my location (and the message when location is refused), Hindi and Marathi, the service worker, and the cloud status line. Broken, and fixed the same day:

| Problem found | Fix |
|---|---|
| The day strip often started on a cut-off day ("…Nov") | The strip now always starts on a whole day, keeps the chosen day in view, and has arrows |
| The sticky control bar (about 140 px) covered section headings when jumping from the menu | It turns compact (86 px) once scrolled, and menu jumps stop below it |
| *My exposure* kept its own home area, so it did not follow the area picked on the map | One "my area": the picker, the map, "use my location" and *I live in* always agree |
| On phones the page was wider than the screen (a long button), and the chart's hour labels overlapped | The button wraps; the chart shows the chosen day on phones; pipeline cards sit flat; forms and accuracy cards use the full width |
| **Listen**: hovering while it spoke hid the button text | The button stays readable and says **Stop** while speaking |
| "Worst moment" could be a past, measured hour worded as a forecast | It now looks only at the hours ahead |
| The BMC note said "hours above Moderate"; the ranking counts air above 60 µg/m³, which is Moderate or worse | Wording corrected in English, Hindi and Marathi |
| The evidence page used four emoji icons and had no way back to the app | Drawn icons, and a "City app" link |
| The pipeline text had a fixed check count | It now shows the count from the last cloud run (`data/status.json`) |
| The share picture's file name was in the chosen script (e.g. Devanagari), which some phones handle badly | Plain names such as `airpulse-ME-2026-11-11.png` |

## Data (all from the challenge package or the ClimateVerse catalogue)

- Zindi challenge package: Train.csv, AdditionalHistory (XKDR 2024 Mumbai stations, other Mumbai stations Oct 2026)
- NOAA GFS forecasts (ClimateVerse)
- BMC administrative ward boundaries (ClimateVerse doi:10.71646/2DGEEJ)
- BMC prabhag boundaries with population (doi:10.71646/EREDWQ)
- UDISE+ 2024-25 school data (doi:10.71646/XJIY8W)

## Run locally

Static site, no build step:

```
python3 -m http.server 8766
# open http://localhost:8766
```

`scripts/build_city.py` and `scripts/build_data.py` produced `data/` and `evidence/data/` inside the competition codebase, which is kept separately.

## Honest limits

- The 22 extra stations are estimated from the four forecast stations; they are not forecast directly. Their data ends on 16 Oct 2026.
- Ward values are interpolated between stations, so local hotspots can be missed.
- Category labels use India's CPCB scale, which is defined for 24-hour averages; hourly colours are a guide.
- Hindi and Marathi text should be reviewed by a native speaker.
- Forecasts are estimates, not medical advice.
