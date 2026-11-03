"""Shared helpers for publisher-specific aggregate loaders."""
import datetime
import urllib.request

TODAY = datetime.date.today().isoformat()
HEADERS = {"User-Agent": "DoorNotes/1.0 (public education data research)"}


def get_bytes(url, max_bytes=16_000_000):
    request = urllib.request.Request(url, headers=HEADERS)
    with urllib.request.urlopen(request, timeout=90) as response:
        raw = response.read(max_bytes + 1)
    if len(raw) > max_bytes:
        raise ValueError("Unexpectedly large publisher file")
    return raw


def entry_points(profession, family, label, segment, year, source, male, female, total):
    if not (0 < total and 0 <= male <= total and 0 <= female <= total - male):
        raise ValueError(f"Invalid numerator or denominator in {source['id']} for {year}")
    return [
        {
            "profession_id": profession, "family": family, "measure": "entrants",
            "measure_label": label, "group": group, "series_id": f"{segment}-{group}",
            "year": year, "value": round(100 * count / total, 6), "unit": "percent",
            "numerator": count, "denominator": total,
            "definition": source["definition"], "source_id": source["id"],
        }
        for group, count in (("black_male", male), ("black_female", female))
    ]
