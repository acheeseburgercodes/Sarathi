from __future__ import annotations

import json
import urllib.parse
import urllib.request
import xml.etree.ElementTree as ET
from concurrent.futures import ThreadPoolExecutor, as_completed
from datetime import datetime, timezone
from typing import Any, Callable

from .storage import LocalStore

USER_AGENT = "Saarthi-Disaster-Intelligence-Python/1.0"
CACHE_TTL = {"weather": 1800, "news": 1200, "seismic": 1800, "events": 1800}


def utc_now() -> str:
    return datetime.now(timezone.utc).isoformat()


def _request(url: str, accept: str, timeout: int) -> bytes:
    request = urllib.request.Request(url, headers={"Accept": accept, "User-Agent": USER_AGENT})
    with urllib.request.urlopen(request, timeout=timeout) as response:
        if response.status != 200:
            raise RuntimeError(f"HTTP {response.status}")
        return response.read()


def _json(url: str, timeout: int = 12) -> Any:
    return json.loads(_request(url, "application/json", timeout).decode("utf-8"))


def weather_source(context: dict[str, Any], timeout: int = 12) -> dict[str, Any]:
    query = urllib.parse.urlencode({
        "latitude": context["latitude"], "longitude": context["longitude"], "timezone": "UTC", "forecast_days": 3,
        "current": "temperature_2m,relative_humidity_2m,precipitation,rain,weather_code,wind_speed_10m",
        "hourly": "temperature_2m,precipitation_probability,precipitation,wind_speed_10m",
    })
    raw = _json(f"https://api.open-meteo.com/v1/forecast?{query}", timeout)
    if not isinstance(raw.get("current"), dict) or not isinstance(raw.get("hourly", {}).get("time"), list):
        raise RuntimeError("Open-Meteo returned an incomplete payload")
    hourly = raw["hourly"]
    records = []
    for index, timestamp in enumerate(hourly["time"][:48]):
        records.append({
            "time": timestamp,
            "temperature_c": (hourly.get("temperature_2m") or [None] * 48)[index],
            "precipitation_mm": (hourly.get("precipitation") or [None] * 48)[index],
            "precipitation_probability_percent": (hourly.get("precipitation_probability") or [None] * 48)[index],
            "wind_speed_kmh": (hourly.get("wind_speed_10m") or [None] * 48)[index],
        })
    return {"source": "Open-Meteo", "authority": "Open-Meteo", "retrieved_at": utc_now(), "source_url": "https://open-meteo.com/en/docs", "current": raw["current"], "hourly": records}


def news_source(context: dict[str, Any], timeout: int = 12) -> dict[str, Any]:
    terms = f'{context["query"]} {context["location"]} when:2d'
    query = urllib.parse.urlencode({"q": terms, "hl": "en-IN", "gl": "IN", "ceid": "IN:en"})
    url = f"https://news.google.com/rss/search?{query}"
    root = ET.fromstring(_request(url, "application/xml,text/xml", timeout))
    articles = []
    for index, item in enumerate(root.findall("./channel/item")[:12], start=1):
        source = item.find("source")
        articles.append({
            "id": f"news-{index}", "title": item.findtext("title"), "published_at": item.findtext("pubDate"),
            "publisher": source.text if source is not None else "Unknown publisher", "url": item.findtext("link"),
        })
    return {"source": "Google News RSS", "authority": "Publishers indexed by Google News", "retrieved_at": utc_now(), "source_url": url, "articles": articles}


def seismic_source(_: dict[str, Any], timeout: int = 12) -> dict[str, Any]:
    url = "https://earthquake.usgs.gov/earthquakes/feed/v1.0/summary/significant_week.geojson"
    raw = _json(url, timeout)
    if not isinstance(raw.get("features"), list):
        raise RuntimeError("USGS returned an incomplete payload")
    events = []
    for item in raw["features"][:12]:
        properties = item.get("properties") or {}
        occurred = properties.get("time")
        events.append({"id": item.get("id"), "title": properties.get("title"), "magnitude": properties.get("mag"), "occurred_at": datetime.fromtimestamp(occurred / 1000, timezone.utc).isoformat() if occurred else None, "coordinates": (item.get("geometry") or {}).get("coordinates"), "url": properties.get("url")})
    return {"source": "USGS", "authority": "United States Geological Survey", "retrieved_at": utc_now(), "source_url": url, "events": events}


def events_source(_: dict[str, Any], timeout: int = 12) -> dict[str, Any]:
    url = "https://eonet.gsfc.nasa.gov/api/v3/events?status=open&limit=12"
    raw = _json(url, timeout)
    if not isinstance(raw.get("events"), list):
        raise RuntimeError("NASA EONET returned an incomplete payload")
    events = []
    for item in raw["events"]:
        geometry = (item.get("geometry") or [{}])[-1]
        categories = item.get("categories") or [{}]
        links = item.get("sources") or [{}]
        events.append({"id": item.get("id"), "title": item.get("title"), "category": categories[0].get("title"), "observed_at": geometry.get("date"), "coordinates": geometry.get("coordinates"), "url": links[0].get("url")})
    return {"source": "NASA EONET", "authority": "NASA Earth Observatory Natural Event Tracker", "retrieved_at": utc_now(), "source_url": "https://eonet.gsfc.nasa.gov/docs/v3", "events": events}


SOURCE_FUNCTIONS: dict[str, Callable[[dict[str, Any], int], dict[str, Any]]] = {
    "weather": weather_source, "news": news_source, "seismic": seismic_source, "events": events_source,
}


def collect_sources(context: dict[str, Any], store: LocalStore, offline: bool = False, timeout: int = 12) -> dict[str, Any]:
    results: dict[str, Any] = {}
    if offline:
        for source in SOURCE_FUNCTIONS:
            cached = store.cached_source(source)
            results[source] = ({"status": "cached", "data": cached["payload"], "cache_age_seconds": cached["age_seconds"], "error": None} if cached else {"status": "unavailable", "data": None, "cache_age_seconds": None, "error": "No cached data is available."})
        return results

    with ThreadPoolExecutor(max_workers=4) as pool:
        futures = {pool.submit(function, context, timeout): name for name, function in SOURCE_FUNCTIONS.items()}
        for future in as_completed(futures):
            name = futures[future]
            try:
                payload = future.result()
                store.cache_source(name, payload)
                results[name] = {"status": "available", "data": payload, "cache_age_seconds": 0, "error": None}
            except Exception as error:  # Source isolation is intentional.
                cached = store.cached_source(name, CACHE_TTL[name])
                results[name] = ({"status": "cached", "data": cached["payload"], "cache_age_seconds": cached["age_seconds"], "error": f"Live request failed: {error}"} if cached else {"status": "unavailable", "data": None, "cache_age_seconds": None, "error": f"Source request failed: {error}"})
    return results
