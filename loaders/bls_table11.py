"""Catalogue CPS Table 11. The table cannot supply a race-by-sex series."""
import re
from html.parser import HTMLParser

from education_common import TODAY, get_bytes

URL = "https://www.bls.gov/cps/cpsaat11.htm"
REVIEWED_YEAR = 2025
REVIEWED_ON = "2026-11-03"


class TableCells(HTMLParser):
    def __init__(self):
        super().__init__()
        self.cells = []
        self.buffer = None

    def handle_starttag(self, tag, attrs):
        if tag in ("th", "td"):
            self.buffer = []

    def handle_data(self, data):
        if self.buffer is not None:
            self.buffer.append(data)

    def handle_endtag(self, tag):
        if tag in ("th", "td") and self.buffer is not None:
            self.cells.append(" ".join(" ".join(self.buffer).split()))
            self.buffer = None


def table_year(content):
    page = TableCells()
    page.feed(content.decode("utf-8"))
    expected = {"Women", "White", "Black or African American", "Asian", "Hispanic or Latino"}
    missing = expected.difference(page.cells)
    if missing or any("Black" in c and ("men" in c.lower() or "women" in c.lower()) for c in page.cells):
        raise ValueError("BLS Table 11 columns changed. Review before using any estimates.")
    years = {int(c) for c in page.cells if re.fullmatch(r"20\d\d", c)}
    if len(years) != 1:
        raise ValueError("BLS Table 11 survey year could not be identified")
    return years.pop()


def load(download, strict, warnings):
    year = REVIEWED_YEAR
    date = REVIEWED_ON
    if download:
        try:
            year = table_year(get_bytes(URL))
            date = TODAY
        except (OSError, ValueError) as exc:
            if strict:
                raise
            warnings.append(f"BLS Table 11: {exc}; retaining header review from {date}")
    definition = ("The CPS reports the percentages of all workers in each occupation who are women "
                  "and who are Black or African American in separate columns. It does not report "
                  "Black men or Black women separately for each detailed occupation.")
    return {"sources": [{
        "id": f"bls-table11-{year}", "publisher":"U.S. Bureau of Labor Statistics",
        "table_name": f"CPS annual averages, Table 11 · Employed people by detailed occupation, sex, race, and Hispanic or Latino ethnicity · {year}",
        "url": URL, "retrieved_on": date, "license": "U.S. government statistical table.",
        "professions": ["electrician", "software-engineer", "musician", "lawyer"],
        "definition": definition, "locator":"Annual averages; percent of total employed columns. Context only.",
    }], "series": [], "notes": [definition]}
