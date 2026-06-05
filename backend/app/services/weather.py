"""Weather provider.

Uses the free, key-less Open-Meteo API when the network is available, and falls
back to a deterministic local simulation so the app always works offline (and so
demos are reproducible). Results are cached in-memory for 30 minutes per city.
"""
from __future__ import annotations

import json
import time
import urllib.parse
import urllib.request
from datetime import date, datetime, timedelta, timezone

# A few common cities pre-mapped so we usually skip the geocoding round-trip.
CITY_COORDS: dict[str, tuple[float, float]] = {
    "mumbai": (19.076, 72.8777),
    "pune": (18.5204, 73.8567),
    "delhi": (28.6139, 77.209),
    "new delhi": (28.6139, 77.209),
    "bangalore": (12.9716, 77.5946),
    "bengaluru": (12.9716, 77.5946),
    "chennai": (13.0827, 80.2707),
    "kolkata": (22.5726, 88.3639),
    "hyderabad": (17.385, 78.4867),
    "ahmedabad": (23.0225, 72.5714),
}

# Open-Meteo WMO weather codes -> human label.
_WEATHER_CODES: dict[int, str] = {
    0: "Clear", 1: "Mainly clear", 2: "Partly cloudy", 3: "Overcast",
    45: "Fog", 48: "Fog", 51: "Light drizzle", 53: "Drizzle", 55: "Heavy drizzle",
    61: "Light rain", 63: "Rain", 65: "Heavy rain", 66: "Freezing rain", 67: "Freezing rain",
    71: "Snow", 73: "Snow", 75: "Heavy snow", 80: "Rain showers", 81: "Rain showers",
    82: "Violent rain showers", 95: "Thunderstorm", 96: "Thunderstorm", 99: "Thunderstorm",
}
_RAIN_CODES = {51, 53, 55, 61, 63, 65, 66, 67, 80, 81, 82, 95, 96, 99}
# West-coast / eastern cities that are wet during the June–September monsoon —
# used only by the offline fallback so the demo still shows realistic rain.
_MONSOON_CITIES = {"mumbai", "pune", "chennai", "kolkata", "goa", "kochi", "mangalore"}

_CACHE: dict[str, tuple[float, dict]] = {}
_CACHE_TTL_SECONDS = 30 * 60
_HTTP_TIMEOUT = 4


def _http_get_json(url: str) -> dict:
    req = urllib.request.Request(url, headers={"User-Agent": "ConstructAI/0.1"})
    with urllib.request.urlopen(req, timeout=_HTTP_TIMEOUT) as resp:
        return json.loads(resp.read().decode("utf-8"))


def _geocode(city: str) -> tuple[float, float]:
    key = city.strip().lower()
    if key in CITY_COORDS:
        return CITY_COORDS[key]
    url = "https://geocoding-api.open-meteo.com/v1/search?" + urllib.parse.urlencode(
        {"name": city, "count": 1}
    )
    data = _http_get_json(url)
    results = data.get("results") or []
    if not results:
        raise ValueError(f"Could not geocode city: {city}")
    return float(results[0]["latitude"]), float(results[0]["longitude"])


def _fetch_live(city: str, days: int) -> dict:
    lat, lon = _geocode(city)
    url = "https://api.open-meteo.com/v1/forecast?" + urllib.parse.urlencode(
        {
            "latitude": lat,
            "longitude": lon,
            "daily": "weather_code,precipitation_sum,temperature_2m_max",
            "forecast_days": days,
            "timezone": "auto",
        }
    )
    data = _http_get_json(url)
    daily = data["daily"]
    out_days = []
    will_rain = False
    for i, day in enumerate(daily["time"]):
        code = int(daily["weather_code"][i])
        precip = float(daily["precipitation_sum"][i] or 0.0)
        tmax = daily["temperature_2m_max"][i]
        rainy = code in _RAIN_CODES or precip >= 2.0
        will_rain = will_rain or rainy
        out_days.append(
            {
                "date": day,
                "condition": _WEATHER_CODES.get(code, "Unknown"),
                "precipitation_mm": round(precip, 1),
                "temp_max_c": round(float(tmax), 1) if tmax is not None else None,
                "rain": rainy,
            }
        )
    today = out_days[0]
    return {
        "city": city,
        "source": "live",
        "condition": today["condition"],
        "temp_c": today["temp_max_c"],
        "precipitation_mm": today["precipitation_mm"],
        "will_rain": will_rain,
        "days": out_days,
    }


def _simulate(city: str, days: int) -> dict:
    """Deterministic offline fallback (stable per city + date)."""
    key = city.strip().lower()
    seed = sum(ord(c) for c in key)
    month = datetime.now(timezone.utc).month
    monsoon = key in _MONSOON_CITIES and month in (6, 7, 8, 9)

    out_days = []
    will_rain = False
    base_temp = 24 + (seed % 8)
    for i in range(days):
        d = date.today() + timedelta(days=i)
        # In monsoon for a monsoon city: mostly rainy. Otherwise an occasional shower.
        rainy = monsoon or ((seed + i) % 4 == 0)
        precip = round(8.0 + (seed % 5) + i, 1) if rainy else 0.0
        will_rain = will_rain or rainy
        out_days.append(
            {
                "date": d.isoformat(),
                "condition": "Rain" if rainy else ("Partly cloudy" if (seed + i) % 2 else "Clear"),
                "precipitation_mm": precip,
                "temp_max_c": float(base_temp - (2 if rainy else 0)),
                "rain": rainy,
            }
        )
    today = out_days[0]
    return {
        "city": city,
        "source": "simulated",
        "condition": today["condition"],
        "temp_c": today["temp_max_c"],
        "precipitation_mm": today["precipitation_mm"],
        "will_rain": will_rain,
        "days": out_days,
    }


def get_forecast(city: str, days: int = 3) -> dict:
    """Return a forecast dict for `city`. Never raises — falls back to simulation."""
    city = (city or "Mumbai").strip() or "Mumbai"
    cache_key = f"{city.lower()}:{days}"
    cached = _CACHE.get(cache_key)
    if cached and (time.time() - cached[0]) < _CACHE_TTL_SECONDS:
        return cached[1]

    try:
        result = _fetch_live(city, days)
    except Exception:
        result = _simulate(city, days)

    _CACHE[cache_key] = (time.time(), result)
    return result
