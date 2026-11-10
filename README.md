# AirPulse Mumbai

**Tomorrow's air for every Mumbai ward: when to go out, who is exposed, and how far to trust it.**

Built by team **Kryptonite** for the Google Mumbai Data Challenge 2026 (Zindi), creative-submission category.

## 🔗 Live app: **https://airpulse-mumbai-2026.web.app**

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

| Feature | What you get |
|---|---|
| **Where are you?** | Pick your area or tap "Use my location"; the nearest ward is chosen |
| **The sky over Mumbai** | An animated skyline whose haze follows the hourly forecast; play through the next 48 hours |
| **Plan my day** | Choose walk, run, kids playing, commute, elderly / heart-lung, or outdoor work. It finds the cleanest hour, the hour to avoid, and plain advice |
| **Cigarette equivalent** | The day's air as cigarettes (Berkeley Earth rule of thumb: 22 µg/m³ over 24 h ≈ 1 cigarette) |
| **The whole city** | All 24 wards coloured hour by hour, with how many people and school students are in Moderate-or-worse air |
| **My day, less smoke** | Enter home ward, work ward, commute times, exercise and children's outdoor time. It counts the PM2.5 you breathe in outdoors (µg, using US EPA breathing rates) and finds a cleaner plan: e.g. 250 → 200 µg (−20%) by walking at 16:00 instead of 06:00 |
| **🔊 Listen** | Reads the forecast and advice aloud in English, Hindi or Marathi (the device's built-in Google / system voices), for elderly users and anyone who prefers listening |
| **For BMC: where to send the squads tonight** | Ranks the 24 wards by people × hours × µg/m³ above the CPCB Moderate line for tonight, with peak hour and schools; downloadable as CSV for the 76 ward-level squads |
| **Share** | A ready-made picture for WhatsApp in your language |
| **Why trust this?** | How the forecast was made and tested, linking to the full evidence dashboard (`/evidence`) |

Links can preselect language and ward: `?lang=hi&ward=ME`.

## Google tools used, and how

| Google tool | What we use it for | Where in this repo |
|---|---|---|
| **Firebase Hosting** | Serves the live app at `airpulse-mumbai-2026.web.app` over HTTPS on Google's global CDN; data files are cached for 5 minutes so a forecast refresh shows up quickly | `firebase.json`, `.firebaserc`; deployed with `firebase deploy --only hosting` |
| **Google Cloud** | The Firebase project `airpulse-mumbai-2026` is a Google Cloud project; it is the home for the hosting and the next backend services | Firebase console → project `airpulse-mumbai-2026` |
| **Google Fonts** | *DM Sans* for Latin text and *Noto Sans Devanagari* (Google's Noto family) so Hindi and Marathi render cleanly on every phone | `<link>` in `index.html` |
| **Google text-to-speech voices** (Chrome and Android, through the Web Speech API) | The 🔊 **Listen** button reads the forecast, the advice and the personal plan aloud in English, Hindi or Marathi; on Android and Chrome these are Google's voices. Marathi falls back to Hindi when no Marathi voice is installed | `speak()` in `app.js` |

The forecast itself comes from our competition model (LightGBM with NOAA GFS weather). The extra city data comes from the ClimateVerse catalogue: BMC wards and population, and UDISE+ schools.

### Deploy it yourself

```bash
npm install -g firebase-tools        # or: npx firebase-tools ...
firebase login
firebase deploy --only hosting --project airpulse-mumbai-2026
```

## How it works

1. **Four-station forecast.** Our competition model (LightGBM, trained with NOAA GFS weather as it was issued) forecasts the four official stations for 11–12 Nov 2026, exactly as submitted to the competition.
2. **From 4 stations to 26.** A second model learned from 2024 data how 22 other Mumbai stations move with those four (ridge regression on the four stations plus time of day), blended 50/50 with a distance-weighted average. Tested two ways:
   - hold-out (16 Nov – 31 Dec 2024, 21 stations): RMSE 24.3 µg/m³ vs 29.0 for the distance average alone;
   - two years later (1–16 Oct 2026, 11 stations): 16.3 vs 16.9.
3. **Wards.** Each ward takes the distance-weighted average of all 26 stations at its centre.
4. **People.** Ward population from BMC prabhag data; school enrolment from UDISE+ 2024-25.

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
