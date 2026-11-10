# AirPulse Mumbai

**Tomorrow's air for every Mumbai ward: when to go out, who is exposed, and how far to trust it.**

Built by team **Kryptonite** for the Google Mumbai Data Challenge 2026 (Zindi), creative-submission category.

Air-quality apps usually show one number for one station. AirPulse turns a forecast for four official stations into something every family in Mumbai can use: a forecast for all 24 BMC wards, a plan for your day, and a picture to send to the family WhatsApp group, in English, Hindi or Marathi.

## What it does

| Feature | What you get |
|---|---|
| **Where are you?** | Pick your area or tap "Use my location"; the nearest ward is chosen |
| **The sky over Mumbai** | An animated skyline whose haze follows the hourly forecast; play through the next 48 hours |
| **Plan my day** | Choose walk, run, kids playing, commute, elderly / heart-lung, or outdoor work. It finds the cleanest hour, the hour to avoid, and plain advice |
| **Cigarette equivalent** | The day's air as cigarettes (Berkeley Earth rule of thumb: 22 µg/m³ over 24 h ≈ 1 cigarette) |
| **The whole city** | All 24 wards coloured hour by hour, with how many people and school students are in Moderate-or-worse air |
| **Share** | A ready-made picture for WhatsApp in your language |
| **Why trust this?** | How the forecast was made and tested, linking to the full evidence dashboard (`/evidence`) |

Links can preselect language and ward: `?lang=hi&ward=ME`.

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
