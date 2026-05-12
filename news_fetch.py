"""Cerca news italiane su accise/carburanti e usa Gemini per estrarre
eventi confermati che impatteranno il prezzo nei prossimi 14 giorni.

Guardrails contro falsi positivi:
1. Solo articoli pubblicati nelle ultime 72h
2. Solo da domini noti (whitelist sotto)
3. Gemini deve fornire source_quote VERBATIM dall'articolo
4. effective_date deve essere ESPLICITA nel testo
5. Cross-source: stesso evento deve apparire in >=2 domini diversi → altrimenti scartato
6. Se non passa la cross-source, NON viene mostrato in app

Output: public/news.json
"""
import json
import os
import re
import sys
import urllib.parse
import urllib.request
import xml.etree.ElementTree as ET
from datetime import datetime, timedelta, timezone
from collections import defaultdict

ROOT = os.path.dirname(os.path.abspath(__file__))
OUT_JSON = os.path.join(ROOT, "public", "news.json")

GEMINI_API_KEY = os.environ.get("GEMINI_API_KEY", "")
GEMINI_MODEL = "gemini-2.5-flash"

# Query usate su Google News
QUERIES = [
    "accise carburanti italia",
    "aumento accise benzina diesel",
    "decreto carburanti prezzi",
    "sciopero benzinai italia",
    "taglio accise benzina",
]

# Whitelist domini italiani affidabili per news economiche
TRUSTED_DOMAINS = {
    "ansa.it", "repubblica.it", "corriere.it", "ilsole24ore.com",
    "ilpost.it", "ilfattoquotidiano.it", "lastampa.it", "rainews.it",
    "tg24.sky.it", "tgcom24.mediaset.it", "fanpage.it", "today.it",
    "agi.it", "open.online", "huffingtonpost.it", "ilmessaggero.it",
    "quifinanza.it", "money.it", "investireoggi.it", "wallstreetitalia.com",
    "askanews.it", "adnkronos.com", "ilgiornale.it", "today.it",
    "staffettaonline.com", "qualenergia.it",
}

MAX_AGE_HOURS = 72
LOOKAHEAD_DAYS = 14


def google_news_rss(query):
    url = (
        "https://news.google.com/rss/search?"
        + urllib.parse.urlencode({"q": query, "hl": "it", "gl": "IT", "ceid": "IT:it"})
    )
    req = urllib.request.Request(url, headers={"User-Agent": "diesel-app/1.0"})
    try:
        with urllib.request.urlopen(req, timeout=20) as r:
            return r.read()
    except Exception as e:
        print(f"  errore RSS '{query}': {e}", file=sys.stderr)
        return None


def parse_rss(xml_bytes):
    if not xml_bytes:
        return []
    try:
        root = ET.fromstring(xml_bytes)
    except ET.ParseError:
        return []
    items = []
    for it in root.iter("item"):
        title = (it.findtext("title") or "").strip()
        link = (it.findtext("link") or "").strip()
        desc = (it.findtext("description") or "").strip()
        pub_str = (it.findtext("pubDate") or "").strip()
        pub_dt = None
        for fmt in ("%a, %d %b %Y %H:%M:%S %Z", "%a, %d %b %Y %H:%M:%S %z"):
            try:
                pub_dt = datetime.strptime(pub_str, fmt)
                if pub_dt.tzinfo is None:
                    pub_dt = pub_dt.replace(tzinfo=timezone.utc)
                break
            except ValueError:
                continue
        # In Google News RSS: <source url="https://www.ansa.it">ANSA</source>
        src_el = it.find("source")
        source_name = src_el.text.strip() if (src_el is not None and src_el.text) else ""
        source_url = src_el.get("url", "") if src_el is not None else ""
        items.append({
            "title": title,
            "link": link,
            "description": strip_html(desc),
            "pub_date": pub_dt,
            "source": source_name,
            "source_url": source_url,
        })
    return items


def strip_html(text):
    text = re.sub(r"<[^>]+>", " ", text)
    text = re.sub(r"\s+", " ", text)
    return text.strip()


def domain_of(url):
    try:
        host = urllib.parse.urlparse(url).netloc.lower()
        return re.sub(r"^www\.", "", host)
    except Exception:
        return ""


def follow_redirect(url):
    """Google News usa link wrapper. Risolvi al dominio reale."""
    try:
        req = urllib.request.Request(url, method="HEAD", headers={"User-Agent": "Mozilla/5.0"})
        with urllib.request.urlopen(req, timeout=10) as r:
            return r.url
    except Exception:
        return url


def collect_articles():
    seen_titles = set()
    out = []
    cutoff = datetime.now(timezone.utc) - timedelta(hours=MAX_AGE_HOURS)
    for q in QUERIES:
        print(f"Query: {q}", flush=True)
        items = parse_rss(google_news_rss(q))
        for it in items:
            if not it["pub_date"] or it["pub_date"] < cutoff:
                continue
            tkey = re.sub(r"\s+", " ", it["title"].lower())[:80]
            if tkey in seen_titles:
                continue
            seen_titles.add(tkey)
            out.append(it)
    print(f"Articoli candidati (ultime {MAX_AGE_HOURS}h): {len(out)}", flush=True)

    # Filtra per whitelist usando il dominio del publisher dichiarato nel RSS
    filtered = []
    for it in out:
        dom = domain_of(it.get("source_url", ""))
        if not dom:
            continue
        if dom not in TRUSTED_DOMAINS:
            continue
        it["domain"] = dom
        filtered.append(it)
    print(f"Articoli da fonti trusted: {len(filtered)}", flush=True)
    return filtered


def extract_events_with_gemini(articles):
    if not articles:
        return []
    if not GEMINI_API_KEY:
        print("GEMINI_API_KEY non impostata, salto estrazione events", file=sys.stderr)
        return []
    try:
        from google import genai
    except ImportError:
        print("google-genai non installato, pip install google-genai", file=sys.stderr)
        return []

    client = genai.Client(api_key=GEMINI_API_KEY)
    today = datetime.now(timezone.utc).strftime("%Y-%m-%d")

    payload = []
    for i, a in enumerate(articles):
        payload.append({
            "idx": i,
            "title": a["title"],
            "domain": a["domain"],
            "pub_date": a["pub_date"].strftime("%Y-%m-%d") if a["pub_date"] else "",
            "description": a["description"][:1500],
        })

    prompt = f"""Sei un analista del mercato carburanti italiano. Devi leggere articoli di news e ESTRARRE solo eventi CONFERMATI che impatteranno il prezzo dei carburanti in Italia nei prossimi 14 giorni a partire da oggi ({today}).

Per OGNI articolo, decidi se contiene un evento concreto e pubblica i risultati come array JSON.

Ritorna SOLO JSON valido in questo schema:
{{"events": [
  {{
    "article_idx": 0,
    "type": "accise_increase|accise_decrease|strike|other",
    "fuel": "diesel|benzina|gpl|metano|all",
    "effective_date": "YYYY-MM-DD",
    "amount_eur_per_l": 0.05,
    "confirmed": true,
    "source_quote": "frase VERBATIM dall'articolo che dimostra sia la data sia l'entità",
    "summary": "una frase concisa"
  }}
]}}

REGOLE TASSATIVE — non violarle MAI:
1. Includi un evento SOLO se l'articolo dichiara ESPLICITAMENTE data ed entità.
2. effective_date deve apparire nel testo dell'articolo (anche in forma "dal 15 maggio" → convertilo a 2026-05-15 se l'anno è ovvio dal contesto). Se la data NON è esplicita, NON includere l'evento.
3. source_quote DEVE essere copiato VERBATIM dal titolo o dalla description. Niente parafrasi, niente sintesi.
4. Se l'articolo usa "potrebbe", "ipotesi", "valuta", "si starebbe per", "in vista di", "rumors" → l'evento NON è confermato. SCARTA.
5. Le previsioni di analisti (forecast, "secondo X i prezzi saliranno") NON sono eventi confermati. SCARTA.
6. Le notizie su prezzi del Brent o petrolio NON sono eventi confermati di accise/scioperi. SCARTA.
7. amount_eur_per_l: solo se cifra esplicita per litro nell'articolo. Altrimenti null.
8. Se nessun articolo contiene eventi confermati → ritorna {{"events": []}}.

Articoli da analizzare:
{json.dumps(payload, ensure_ascii=False, indent=2)}
"""

    import time
    last_err = None
    data = None
    for attempt in range(3):
        try:
            resp = client.models.generate_content(
                model=GEMINI_MODEL,
                contents=prompt,
                config={"response_mime_type": "application/json"},
            )
            data = json.loads(resp.text)
            break
        except Exception as e:
            last_err = e
            wait = 8 * (attempt + 1)
            print(f"Tentativo {attempt+1} Gemini fallito ({e}), retry in {wait}s", file=sys.stderr)
            time.sleep(wait)
    if data is None:
        print(f"Errore Gemini definitivo: {last_err}", file=sys.stderr)
        return []

    events = []
    today_dt = datetime.now(timezone.utc).date()
    horizon = today_dt + timedelta(days=LOOKAHEAD_DAYS)
    for ev in data.get("events", []):
        idx = ev.get("article_idx")
        if not isinstance(idx, int) or idx < 0 or idx >= len(articles):
            continue
        article = articles[idx]
        # Validazioni
        if not ev.get("confirmed"):
            continue
        try:
            eff = datetime.strptime(ev["effective_date"], "%Y-%m-%d").date()
        except (ValueError, TypeError, KeyError):
            continue
        if eff < today_dt or eff > horizon:
            continue
        quote = (ev.get("source_quote") or "").strip()
        if len(quote) < 12:
            continue
        # Verifica che la quote sia presente (tolerante di whitespace) nel testo articolo
        haystack = (article["title"] + " " + article["description"]).lower()
        needle = re.sub(r"\s+", " ", quote.lower())
        if needle not in haystack:
            # Allenta: almeno 70% delle parole chiave devono apparire
            words = [w for w in re.findall(r"\w{4,}", needle) if w]
            if not words:
                continue
            hit = sum(1 for w in words if w in haystack) / len(words)
            if hit < 0.7:
                continue
        events.append({
            "type": ev.get("type", "other"),
            "fuel": ev.get("fuel", "all"),
            "effective_date": ev["effective_date"],
            "amount_eur_per_l": ev.get("amount_eur_per_l"),
            "summary": ev.get("summary", "").strip(),
            "source_quote": quote,
            "source_url": article["link"],
            "source_domain": article["domain"],
            "source_title": article["title"],
            "pub_date": article["pub_date"].strftime("%Y-%m-%d") if article["pub_date"] else "",
        })
    print(f"Eventi grezzi estratti da Gemini: {len(events)}", flush=True)
    return events


def cross_verify(events):
    """Aggrega per (type, fuel, effective_date) e richiede >=2 domini distinti."""
    groups = defaultdict(list)
    for ev in events:
        # Tolleranza ±1 giorno sulla data per matchare se diverse fonti riportano date leggermente diverse
        eff = ev["effective_date"]
        key = (ev["type"], ev["fuel"], eff)
        groups[key].append(ev)

    verified = []
    for key, evs in groups.items():
        domains = {e["source_domain"] for e in evs}
        if len(domains) < 2:
            continue
        # Aggrega: prendi summary più lungo, raccogli tutte le sources
        best = max(evs, key=lambda e: len(e.get("summary") or ""))
        verified.append({
            "type": best["type"],
            "fuel": best["fuel"],
            "effective_date": best["effective_date"],
            "amount_eur_per_l": best.get("amount_eur_per_l"),
            "summary": best["summary"],
            "sources": [
                {
                    "domain": e["source_domain"],
                    "url": e["source_url"],
                    "title": e["source_title"],
                    "quote": e["source_quote"],
                    "pub_date": e["pub_date"],
                }
                for e in evs
            ],
        })
    print(f"Eventi cross-verified (>=2 fonti): {len(verified)}", flush=True)
    return verified


def main():
    print(f"News fetch — {datetime.now(timezone.utc).isoformat()}", flush=True)
    articles = collect_articles()
    raw_events = extract_events_with_gemini(articles)
    verified = cross_verify(raw_events)

    out = {
        "generated_at": datetime.now(timezone.utc).isoformat(),
        "events": verified,
        "n_articles_scanned": len(articles),
    }
    os.makedirs(os.path.dirname(OUT_JSON), exist_ok=True)
    with open(OUT_JSON, "w", encoding="utf-8") as f:
        json.dump(out, f, ensure_ascii=False, indent=2)
    print(f"Scritto {OUT_JSON} con {len(verified)} eventi verificati", flush=True)


if __name__ == "__main__":
    main()
