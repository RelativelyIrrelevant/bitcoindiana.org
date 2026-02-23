#!/usr/bin/env python3
import json
import os
import random
import sys
import time
from email.utils import parsedate_to_datetime
from urllib.request import Request, urlopen
from urllib.error import HTTPError, URLError
from xml.etree import ElementTree as ET

DEFAULT_MASTER_JSON = "master_meetups.json"

OUT_WITH = "meetups_with_pubdate_2026.json"
OUT_WITHOUT = "meetups_without_pubdate_2026.json"
OUT_ERRORS = "meetups_rss_errors.json"

HTTP_TIMEOUT_SECS = 30

# Random pause after each request to meetup.com
SLEEP_MIN_SECS = 10
SLEEP_MAX_SECS = 60

HEADERS = {
    "User-Agent": "meetup-rss-pubdate-year-check/1.2 (Debian12; local-script)"
}

TARGET_YEAR = int(os.environ.get("TARGET_YEAR", "2026"))


def sleep_random(meetup_id=""):
    s = random.randint(SLEEP_MIN_SECS, SLEEP_MAX_SECS)
    prefix = f"[{meetup_id}] " if meetup_id else ""
    print(f"{prefix}sleeping {s}s ...", flush=True)
    time.sleep(s)


def http_get_bytes(url):
    req = Request(url, headers=HEADERS)
    with urlopen(req, timeout=HTTP_TIMEOUT_SECS) as resp:
        return resp.read()


def rss_has_pubdate_year(xml_bytes, target_year):
    """
    Returns (has_match: bool, pubdates_seen: int, pubdates_parsed: int)
    Only considers <channel><item><pubDate>.
    """
    root = ET.fromstring(xml_bytes)
    channel = root.find("channel")
    if channel is None:
        return (False, 0, 0)

    pubdates_seen = 0
    pubdates_parsed = 0
    has_match = False

    for item in channel.findall("item"):
        pub = item.findtext("pubDate")
        if not pub:
            continue

        pubdates_seen += 1
        try:
            dt = parsedate_to_datetime(pub)
            pubdates_parsed += 1
            if dt.year == target_year:
                has_match = True
        except Exception:
            continue

    return (has_match, pubdates_seen, pubdates_parsed)


def fmt_tally(processed, total, matched, no_match, err):
    return (f"TALLY processed {processed}/{total} | "
            f"MATCH {matched} | NO-MATCH {no_match} | ERROR {err}")


def main(master_path):
    with open(master_path, "r", encoding="utf-8") as f:
        meetups = json.load(f)

    total = len(meetups)

    with_events = []
    without_events = []
    errors = []

    matched_count = 0
    no_match_count = 0
    error_count = 0
    processed = 0

    print(f"Target pubDate year: {TARGET_YEAR}", flush=True)
    print(f"Total meetups to check: {total}", flush=True)
    print("-" * 72, flush=True)

    for idx, m in enumerate(meetups, start=1):
        meetup_id = m.get("meetupID") or m.get("meetupName") or f"row-{idx}"
        rss_url = m.get("meetupUrlRss")

        if not rss_url:
            processed += 1
            error_count += 1
            msg = "missing meetupUrlRss"
            errors.append({"meetupID": meetup_id, "error": msg})
            without_events.append(m)  # conservative default

            print(f"{idx:03d}/{total} [{meetup_id}] ERROR - {msg}", flush=True)
            print(fmt_tally(processed, total, matched_count, no_match_count, error_count), flush=True)
            print("-" * 72, flush=True)
            continue

        print(f"{idx:03d}/{total} [{meetup_id}] fetching RSS: {rss_url}", flush=True)

        try:
            xml_bytes = http_get_bytes(rss_url)
            has_match, pub_seen, pub_parsed = rss_has_pubdate_year(xml_bytes, TARGET_YEAR)

            processed += 1

            if has_match:
                matched_count += 1
                with_events.append(m)
                print(
                    f"{idx:03d}/{total} [{meetup_id}] MATCH - pubDate year {TARGET_YEAR} "
                    f"(pubDate tags: {pub_seen}, parsed: {pub_parsed})",
                    flush=True
                )
            else:
                no_match_count += 1
                without_events.append(m)
                print(
                    f"{idx:03d}/{total} [{meetup_id}] NO-MATCH - no pubDate with year {TARGET_YEAR} "
                    f"(pubDate tags: {pub_seen}, parsed: {pub_parsed})",
                    flush=True
                )

        except HTTPError as e:
            processed += 1
            error_count += 1
            msg = f"HTTPError {e.code}: {e.reason}"
            errors.append({"meetupID": meetup_id, "meetupUrlRss": rss_url, "error": msg})
            without_events.append(m)
            print(f"{idx:03d}/{total} [{meetup_id}] ERROR - {msg}", flush=True)

        except URLError as e:
            processed += 1
            error_count += 1
            msg = f"URLError: {e.reason}"
            errors.append({"meetupID": meetup_id, "meetupUrlRss": rss_url, "error": msg})
            without_events.append(m)
            print(f"{idx:03d}/{total} [{meetup_id}] ERROR - {msg}", flush=True)

        except ET.ParseError as e:
            processed += 1
            error_count += 1
            msg = f"XML ParseError: {str(e)}"
            errors.append({"meetupID": meetup_id, "meetupUrlRss": rss_url, "error": msg})
            without_events.append(m)
            print(f"{idx:03d}/{total} [{meetup_id}] ERROR - {msg}", flush=True)

        except Exception as e:
            processed += 1
            error_count += 1
            msg = str(e)
            errors.append({"meetupID": meetup_id, "meetupUrlRss": rss_url, "error": msg})
            without_events.append(m)
            print(f"{idx:03d}/{total} [{meetup_id}] ERROR - {msg}", flush=True)

        # Print running tally after each record
        print(fmt_tally(processed, total, matched_count, no_match_count, error_count), flush=True)
        print("-" * 72, flush=True)

        # Random pause after each meetup.com request
        sleep_random(meetup_id)

    # stable sort
    with_events.sort(key=lambda x: (x.get("meetupID") or "").lower())
    without_events.sort(key=lambda x: (x.get("meetupID") or "").lower())
    errors.sort(key=lambda x: (x.get("meetupID") or "").lower())

    with open(OUT_WITH, "w", encoding="utf-8") as f:
        json.dump(with_events, f, ensure_ascii=False, indent=2)

    with open(OUT_WITHOUT, "w", encoding="utf-8") as f:
        json.dump(without_events, f, ensure_ascii=False, indent=2)

    with open(OUT_ERRORS, "w", encoding="utf-8") as f:
        json.dump(errors, f, ensure_ascii=False, indent=2)

    print("\nFINAL:", flush=True)
    print(fmt_tally(processed, total, matched_count, no_match_count, error_count), flush=True)
    print(f"Wrote: {OUT_WITH}", flush=True)
    print(f"Wrote: {OUT_WITHOUT}", flush=True)
    print(f"Wrote: {OUT_ERRORS}", flush=True)


if __name__ == "__main__":
    master_path = sys.argv[1] if len(sys.argv) > 1 else DEFAULT_MASTER_JSON
    main(master_path)

