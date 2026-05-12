"""Scarica i dati MIMIT, li unisce, produce:
- public/stations.json    (dataset usato dal frontend, multi-carburante)
- data/history.csv        (serie storica medie nazionali, append giornaliero)

Fonte principale prezzi: Osservaprezzi live.
Fallback: CSV "prezzo alle 8" se l'API live non risponde.
"""
import csv
import json
import os
import sys
import time
import urllib.request
from datetime import date, datetime, timezone
from io import StringIO
from collections import defaultdict
from statistics import mean, pstdev
from zoneinfo import ZoneInfo

PRICES_URL = "https://www.mimit.gov.it/images/exportCSV/prezzo_alle_8.csv"
STATIONS_URL = "https://www.mimit.gov.it/images/exportCSV/anagrafica_impianti_attivi.csv"
LIVE_API_URL = "https://carburanti.mise.gov.it/ospzApi/"

# I nomi MIMIT li mappiamo a chiavi corte (riducono peso JSON: 21k stazioni × 4 carburanti)
FUELS = {
    "Gasolio": "diesel",
    "Benzina": "benzina",
    "GPL": "gpl",
    "Metano": "metano",
}

LIVE_FUEL_IDS = {
    1: "benzina",
    2: "diesel",
    3: "metano",
    4: "gpl",
}

PRICE_LIMITS = {
    "diesel": (1.0, 3.5),
    "benzina": (1.0, 3.5),
    "gpl": (0.3, 2.0),
    "metano": (0.5, 4.0),
}

ROOT = os.path.dirname(os.path.abspath(__file__))
OUT_JSON = os.path.join(ROOT, "public", "stations.json")
HISTORY_CSV = os.path.join(ROOT, "data", "history.csv")


def download(url):
    req = urllib.request.Request(url, headers={"User-Agent": "diesel-app/1.0"})
    with urllib.request.urlopen(req, timeout=60) as r:
        return r.read().decode("utf-8", errors="replace")


def italy_today():
    try:
        return datetime.now(ZoneInfo("Europe/Rome")).date().isoformat()
    except Exception:
        return date.today().isoformat()


def utc_now_iso():
    return datetime.now(timezone.utc).isoformat(timespec="seconds").replace("+00:00", "Z")


def live_api_json(path, payload=None, retries=3):
    data = None
    headers = {
        "Accept": "application/json",
        "User-Agent": "osservatorio-prezzi-node-wrapper",
    }
    if payload is not None:
        data = json.dumps(payload, separators=(",", ":")).encode("utf-8")
        headers["Content-Type"] = "application/json"

    req = urllib.request.Request(
        LIVE_API_URL + path,
        data=data,
        headers=headers,
        method="POST" if payload is not None else "GET",
    )

    last_error = None
    for attempt in range(retries):
        try:
            with urllib.request.urlopen(req, timeout=90) as r:
                charset = r.headers.get_content_charset() or "utf-8"
                return json.loads(r.read().decode(charset, errors="replace"))
        except Exception as exc:
            last_error = exc
            if attempt < retries - 1:
                time.sleep(1.5 * (attempt + 1))
    raise last_error


def parse_mimit_csv(text):
    """I CSV MIMIT hanno 'Estrazione del YYYY-MM-DD' come prima riga,
    poi l'header vero, poi i dati. Separatore '|'."""
    lines = text.splitlines()
    extraction = lines[0].replace("Estrazione del ", "").strip()
    body = "\n".join(lines[1:])
    reader = csv.DictReader(StringIO(body), delimiter="|")
    return extraction, list(reader)


def parse_float(s):
    if not s:
        return None
    try:
        return float(s.replace(",", "."))
    except ValueError:
        return None


def dt_to_iso(s):
    """Converte 'DD/MM/YYYY HH:MM:SS' (formato MIMIT) in 'YYYY-MM-DD HH:MM' (più compatto)."""
    if not s:
        return None
    try:
        from datetime import datetime as _dt
        return _dt.strptime(s, "%d/%m/%Y %H:%M:%S").strftime("%Y-%m-%d %H:%M")
    except (ValueError, TypeError):
        return None


def api_dt_to_iso(s):
    """Converte l'ISO della live API in 'YYYY-MM-DD HH:MM' per il frontend."""
    if not s:
        return None
    try:
        return datetime.fromisoformat(str(s)).strftime("%Y-%m-%d %H:%M")
    except (ValueError, TypeError):
        return None


def compute_forecast(series):
    """Regressione lineare semplice sulle ultime 4-8 settimane.
    Input: lista di dict {date: 'YYYY-MM-DD', avg: float} ordinata per data.
    Output: {direction: 'down'|'flat'|'up', delta_c: float, days_ahead: int, confidence: float}
    """
    if len(series) < 4:
        return {"direction": "flat", "delta_c": 0.0, "days_ahead": 7, "confidence": 0.0}

    points = series[-8:]  # ultime 4-8 settimane
    n = len(points)

    # x = indice settimana relativo (0..n-1), y = prezzo
    xs = list(range(n))
    ys = [p["avg"] for p in points]

    # Mean
    mx = sum(xs) / n
    my = sum(ys) / n

    # Slope (least squares) e R^2
    num = sum((xs[i] - mx) * (ys[i] - my) for i in range(n))
    den_x = sum((xs[i] - mx) ** 2 for i in range(n))
    if den_x == 0:
        return {"direction": "flat", "delta_c": 0.0, "days_ahead": 7, "confidence": 0.0}
    slope = num / den_x  # eur/settimana
    intercept = my - slope * mx
    ss_res = sum((ys[i] - (intercept + slope * xs[i])) ** 2 for i in range(n))
    ss_tot = sum((ys[i] - my) ** 2 for i in range(n))
    r2 = 1 - ss_res / ss_tot if ss_tot > 0 else 0.0

    if r2 < 0.5:
        return {"direction": "flat", "delta_c": 0.0, "days_ahead": 7, "confidence": round(r2, 2)}

    slope_cents_per_week = slope * 100  # eur/sett -> c/sett
    abs_slope = abs(slope_cents_per_week)

    # days_ahead in base alla pendenza
    if abs_slope > 1.0:
        days_ahead = 2
    elif abs_slope >= 0.3:
        days_ahead = 5
    else:
        return {"direction": "flat", "delta_c": 0.0, "days_ahead": 7, "confidence": round(r2, 2)}

    delta_c = round(slope_cents_per_week * (days_ahead / 7.0), 2)
    direction = "down" if slope < 0 else "up"

    return {
        "direction": direction,
        "delta_c": delta_c,
        "days_ahead": days_ahead,
        "confidence": round(r2, 2),
    }


def empty_source(kind, name):
    return {
        "kind": kind,
        "name": name,
        "generated_at": utc_now_iso(),
        "latest_price_at": None,
    }


def set_bucket_price(bucket, key, is_self, price):
    if price is None:
        return
    lo, hi = PRICE_LIMITS.get(key, (0, 10))
    if price < lo or price > hi:
        return
    slot = bucket.setdefault(key, [None, None])
    slot[0 if is_self else 1] = price


def fetch_live_prices():
    source = empty_source("live_api", "MIMIT Osservaprezzi live")
    by_id = {}

    regions_payload = live_api_json("registry/region")
    regions = regions_payload.get("results") or []
    if not regions:
        raise RuntimeError("lista regioni Osservaprezzi vuota")

    print("Scarico prezzi live Osservaprezzi...", flush=True)
    total_results = 0
    for region in regions:
        region_id = int(region["id"])
        region_name = region.get("description") or str(region_id)
        payload = {
            "region": region_id,
            "province": None,
            "town": None,
            "priceOrder": "asc",
            "fuelType": "0-x",
        }
        data = live_api_json("search/area", payload=payload)
        results = data.get("results") or []
        total_results += len(results)
        print(f"  {region_name}: {len(results)} impianti", flush=True)

        for item in results:
            sid = str(item.get("id") or "").strip()
            if not sid:
                continue
            bucket = by_id.setdefault(sid, {})

            for fuel in item.get("fuels") or []:
                try:
                    fuel_id = int(fuel.get("fuelId"))
                except (TypeError, ValueError):
                    continue
                key = LIVE_FUEL_IDS.get(fuel_id)
                if not key:
                    continue
                price = parse_float(str(fuel.get("price") or ""))
                set_bucket_price(bucket, key, bool(fuel.get("isSelf")), price)

            updated = api_dt_to_iso(item.get("insertDate"))
            if updated and updated > bucket.get("_updated", ""):
                bucket["_updated"] = updated
            if updated and (source["latest_price_at"] is None or updated > source["latest_price_at"]):
                source["latest_price_at"] = updated

            location = item.get("location") or {}
            bucket.setdefault("_name", (item.get("name") or "").strip())
            bucket.setdefault("_brand", (item.get("brand") or "").strip())
            bucket.setdefault("_address", (item.get("address") or "").strip())
            bucket.setdefault("_lat", location.get("lat"))
            bucket.setdefault("_lng", location.get("lng"))

    if not by_id:
        raise RuntimeError("Osservaprezzi live non ha restituito impianti")

    source["regions"] = len(regions)
    source["raw_results"] = total_results
    source["station_count"] = len(by_id)
    print(f"Prezzi live: {len(by_id)} impianti unici, {total_results} risultati grezzi", flush=True)
    return by_id, source, italy_today()


def fetch_csv_prices():
    print("Scarico prezzi CSV prezzo alle 8...", flush=True)
    extraction, prices = parse_mimit_csv(download(PRICES_URL))
    print(f"  estrazione: {extraction}, righe: {len(prices)}", flush=True)

    by_id = {}
    for row in prices:
        fuel_name = row.get("descCarburante")
        if fuel_name not in FUELS:
            continue
        key = FUELS[fuel_name]
        sid = row.get("idImpianto")
        if not sid:
            continue
        price = parse_float(row.get("prezzo"))
        bucket = by_id.setdefault(sid, {})
        set_bucket_price(bucket, key, row.get("isSelf") == "1", price)
        updated = dt_to_iso((row.get("dtComu") or "").strip())
        if updated and updated > bucket.get("_updated", ""):
            bucket["_updated"] = updated

    source = empty_source("csv_daily", "MIMIT CSV prezzo alle 8")
    source["latest_price_at"] = extraction
    source["station_count"] = len(by_id)
    return by_id, source, extraction


def supplement_missing_prices(primary_by_id, supplement_by_id):
    added_stations = 0
    added_fuels = 0

    for sid, supplement_bucket in supplement_by_id.items():
        primary_bucket = primary_by_id.get(sid)
        if primary_bucket is None:
            primary_by_id[sid] = supplement_bucket
            added_stations += 1
            continue

        for key, value in supplement_bucket.items():
            if str(key).startswith("_"):
                continue
            current = primary_bucket.get(key)
            current_has_price = isinstance(current, list) and any(p is not None for p in current)
            supplement_has_price = isinstance(value, list) and any(p is not None for p in value)
            if not current_has_price and supplement_has_price:
                primary_bucket[key] = value
                added_fuels += 1

        if not primary_bucket.get("_updated") and supplement_bucket.get("_updated"):
            primary_bucket["_updated"] = supplement_bucket["_updated"]

    return added_stations, added_fuels


def fetch_prices_primary_live():
    try:
        by_id, source, snapshot_date = fetch_live_prices()
    except Exception as exc:
        print(f"Live Osservaprezzi non disponibile, uso fallback CSV: {exc}", file=sys.stderr, flush=True)
        by_id, source, snapshot_date = fetch_csv_prices()
        source["fallback"] = True
        source["fallback_reason"] = str(exc)
        return by_id, source, snapshot_date

    try:
        csv_by_id, csv_source, _ = fetch_csv_prices()
        live_station_count = len(by_id)
        added_stations, added_fuels = supplement_missing_prices(by_id, csv_by_id)
        if added_stations or added_fuels:
            source["primary_station_count"] = live_station_count
            source["station_count"] = len(by_id)
            source["supplement"] = {
                "kind": csv_source["kind"],
                "name": csv_source["name"],
                "latest_price_at": csv_source["latest_price_at"],
                "station_count": csv_source["station_count"],
                "added_station_count": added_stations,
                "added_fuel_count": added_fuels,
            }
            print(
                f"Integrazione CSV: +{added_stations} impianti mancanti, +{added_fuels} carburanti",
                flush=True,
            )
    except Exception as exc:
        source["supplement_error"] = str(exc)
        print(f"Integrazione CSV non disponibile: {exc}", file=sys.stderr, flush=True)

    return by_id, source, snapshot_date


def main():
    by_id, source, snapshot_date = fetch_prices_primary_live()

    print("Scarico anagrafica...", flush=True)
    _, stations_raw = parse_mimit_csv(download(STATIONS_URL))
    print(f"  impianti: {len(stations_raw)}", flush=True)

    # Metadata CSV: dettagli stabili (comune, provincia, tipo impianto, gestore).
    # I prezzi restano quelli della fonte primaria scelta sopra.
    stations_meta = {str(s.get("idImpianto") or "").strip(): s for s in stations_raw}

    # Join con anagrafica
    stations = []
    for sid, raw_prices in by_id.items():
        s = stations_meta.get(str(sid), {})
        lat = parse_float(s.get("Latitudine")) or parse_float(str(raw_prices.get("_lat") or ""))
        lng = parse_float(s.get("Longitudine")) or parse_float(str(raw_prices.get("_lng") or ""))
        if lat is None or lng is None:
            continue
        if not (35 < lat < 48 and 6 < lng < 19):  # bounding box Italia
            continue
        prices_d = {k: v for k, v in raw_prices.items() if not str(k).startswith("_")}
        updated = raw_prices.get("_updated")
        # Scarta stazioni senza alcun prezzo valido
        if not any(
            isinstance(v, list) and any(p is not None for p in v)
            for v in prices_d.values()
        ):
            continue
        # Tipo impianto: "Stradale", "Autostradale", "Italo-Slovena", etc.
        tipo = (s.get("Tipo Impianto") or "").strip()
        stations.append({
            "id": int(sid),
            "name": (s.get("Nome Impianto") or raw_prices.get("_name") or "").strip(),
            "brand": (s.get("Bandiera") or raw_prices.get("_brand") or "").strip(),
            "operator": (s.get("Gestore") or "").strip(),
            "type": tipo,
            "is_highway": tipo.lower().startswith("autostrad"),
            "address": (s.get("Indirizzo") or raw_prices.get("_address") or "").strip(),
            "city": (s.get("Comune") or "").strip(),
            "prov": (s.get("Provincia") or "").strip(),
            "lat": round(lat, 6),
            "lng": round(lng, 6),
            "p": prices_d,
            "updated": updated,
        })

    print(f"Impianti totali con prezzi validi: {len(stations)}", flush=True)

    # Statistiche nazionali per carburante.
    # Diesel/Benzina: solo prezzi self (più uniformi).
    # GPL/Metano: usiamo self quando c'è altrimenti servito, perché 95% pompe GPL sono servite.
    SELF_ONLY = {"diesel", "benzina"}
    national = {}
    for fuel_name, key in FUELS.items():
        self_prices = []
        for s in stations:
            pair = s["p"].get(key)
            if not pair:
                continue
            if key in SELF_ONLY:
                p = pair[0]
            else:
                p = pair[0] if pair[0] is not None else pair[1]
            if p is not None:
                self_prices.append(p)
        if self_prices:
            national[key] = {
                "avg": round(mean(self_prices), 4),
                "min": round(min(self_prices), 3),
                "max": round(max(self_prices), 3),
                "n": len(self_prices),
                "p10": round(quantile(self_prices, 0.10), 3),
                "p90": round(quantile(self_prices, 0.90), 3),
                "std": round(pstdev(self_prices), 4) if len(self_prices) > 1 else 0,
            }
            print(f"  {fuel_name}: media {national[key]['avg']}€, n={national[key]['n']}", flush=True)
        else:
            national[key] = None

    # Statistiche per provincia (per benchmark locale: Sicilia diversa da Trentino)
    by_province = {}
    prices_by_prov_fuel = defaultdict(lambda: defaultdict(list))
    for s in stations:
        prov = s["prov"]
        if not prov:
            continue
        for key, pair in s["p"].items():
            if not isinstance(pair, list):
                continue
            if key in SELF_ONLY:
                p = pair[0]
            else:
                p = pair[0] if pair[0] is not None else pair[1]
            if p is not None:
                prices_by_prov_fuel[prov][key].append(p)
    for prov, fuels_data in prices_by_prov_fuel.items():
        by_province[prov] = {}
        for key, vals in fuels_data.items():
            if len(vals) >= 3:  # serve almeno 3 distributori per fare statistica
                by_province[prov][key] = {
                    "avg": round(mean(vals), 4),
                    "min": round(min(vals), 3),
                    "n": len(vals),
                    "std": round(pstdev(vals), 4) if len(vals) > 1 else 0,
                }
    print(f"Province con statistiche valide: {len(by_province)}", flush=True)

    # Aggiorna history.csv (una riga per giorno × carburante, idempotente)
    os.makedirs(os.path.dirname(HISTORY_CSV), exist_ok=True)
    today = snapshot_date or italy_today()
    history = {}
    if os.path.exists(HISTORY_CSV):
        with open(HISTORY_CSV, encoding="utf-8") as f:
            r = csv.DictReader(f)
            for row in r:
                d = row.get("date")
                if not d:
                    continue
                history.setdefault(d, {})
                if row.get("fuel"):
                    history[d][row["fuel"]] = row
    history.setdefault(today, {})
    for key, stats in national.items():
        if stats is None:
            continue
        history[today][key] = {
            "date": today,
            "fuel": key,
            "nat_avg": f"{stats['avg']:.4f}",
            "nat_min": f"{stats['min']:.3f}",
            "nat_max": f"{stats['max']:.3f}",
            "n_stations": str(stats["n"]),
        }
    with open(HISTORY_CSV, "w", encoding="utf-8", newline="") as f:
        w = csv.DictWriter(
            f,
            fieldnames=["date", "fuel", "nat_avg", "nat_min", "nat_max", "n_stations"],
            lineterminator="\r\n",
        )
        w.writeheader()
        for d in sorted(history):
            for key in FUELS.values():
                if key in history[d]:
                    w.writerow(history[d][key])

    # Costruisci serie temporali per il frontend.
    # Manteniamo tutta la history disponibile: il grafico dell'app puo selezionare
    # periodi lunghi come 1a, 5a e Max senza dover rifare il fetch.
    series = {}
    for key in FUELS.values():
        rows = []
        for d in sorted(history):
            if key in history[d]:
                try:
                    rows.append({"date": d, "avg": float(history[d][key]["nat_avg"])})
                except (ValueError, KeyError):
                    pass
        series[key] = rows

    forecast = {key: compute_forecast(series.get(key, [])) for key in FUELS.values()}

    os.makedirs(os.path.dirname(OUT_JSON), exist_ok=True)
    with open(OUT_JSON, "w", encoding="utf-8") as f:
        json.dump({
            "extracted_at": today,
            "source": source,
            "fuels": list(FUELS.values()),
            "national": national,
            "by_province": by_province,
            "history": series,
            "forecast": forecast,
            "stations": stations,
        }, f, ensure_ascii=False, separators=(",", ":"))

    size_mb = os.path.getsize(OUT_JSON) / 1024 / 1024
    print(f"Scritto {OUT_JSON} ({size_mb:.2f} MB)", flush=True)


def quantile(values, q):
    s = sorted(values)
    pos = (len(s) - 1) * q
    lo = int(pos)
    hi = min(lo + 1, len(s) - 1)
    frac = pos - lo
    return s[lo] * (1 - frac) + s[hi] * frac


if __name__ == "__main__":
    try:
        main()
    except Exception as e:
        print(f"ERRORE: {e}", file=sys.stderr)
        raise
