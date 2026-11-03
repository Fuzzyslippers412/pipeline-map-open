"""FACTS A-9 and A-12. Reviewed CSV preserves only the numerator and denominator cells used."""
import csv
import re
import subprocess
import tempfile
from pathlib import Path

from education_common import TODAY, entry_points, get_bytes

REVIEWED = Path(__file__).parent / "reviewed" / "aamc-cells.csv"
SOURCE = {
    "aamc-a9-2016": ("74421", "A-9", 2013, 2016),
    "aamc-a9-2018": ("72881", "A-9", 2015, 2018),
    "aamc-a9-2022": ("74066", "A-9", 2019, 2022),
    "aamc-a12-2023": ("6046", "A-12", 2020, 2023),
}
A9 = ("Black or African American only. Men or women divided by all matriculants "
      "reporting one of those genders at U.S. MD-granting schools. Non-U.S. citizens "
      "without permanent residency form a separate race-reporting category. Year is "
      "the fall the entering class started.")
A12 = ("Black or African American alone. Men or women divided by all U.S. MD matriculants, "
       "including those who gave another gender or did not report gender. Non-U.S. citizens "
       "without permanent residency form a separate race-reporting category. Year is the "
       "fall the entering class started.")


def row_numbers(line):
    return [int(value.replace(",", "")) for value in re.findall(r"\b\d[\d,]*\b", line)]


def parse_pdf(content, table, first):
    if not content.startswith(b"%PDF"):
        raise ValueError("AAMC returned a webpage instead of its public PDF")
    with tempfile.TemporaryDirectory() as directory:
        path = Path(directory, "table.pdf")
        path.write_bytes(content)
        txt = subprocess.check_output(["pdftotext", "-layout", str(path), "-"], text=True)
    if f"Table {table}" not in txt:
        raise ValueError(f"Downloaded file is not Table {table}")
    if table == "A-9":
        race = re.search(r"^\s*Black or African American Only\s+(.+)$", txt, re.M)
        total = re.search(r"^\s*Total Matriculants\s+(.+)$", txt, re.M)
        if not (race and total):
            raise ValueError("Missing A-9 count rows")
        nums, den = row_numbers(race[1]), row_numbers(total[1])
        hdr = re.search(r"\b(Women|Men)\s+(Men|Women)\s+Total", txt)
        if not hdr or len(nums) != 12 or len(den) != 12:
            raise ValueError("A-9 column headings or count layout changed")
        men = 0 if hdr[1] == "Men" else 1
        return {first + i: (nums[3*i+men], nums[3*i+1-men], den[3*i+2]) for i in range(4)}

    # Each A-12 section has race rows, then four adjacent blocks of applicant,
    # first-time applicant, acceptee and matriculant columns. Extract only the last
    # column of each block, validating the row width before using it.
    race_rows = re.findall(r"^\s*Black or African American\s+([\d,\s]+?)\s*$", txt, re.M)
    totals = re.findall(r"^\s*Total\s+([\d,\s]+?)\s*$", txt, re.M)
    if len(race_rows) != 3 or len(totals) != 1:
        raise ValueError("A-12 gender sections or All total layout changed")
    men, women, total = map(row_numbers, (race_rows[0], race_rows[1], totals[0]))
    if any(len(row) != 16 for row in (men, women, total)):
        raise ValueError("A-12 matriculant column layout changed")
    return {first+i: (men[4*i+3], women[4*i+3], total[4*i+3]) for i in range(4)}


def load(download, strict, warnings):
    with REVIEWED.open(newline="") as file:
        audited = list(csv.DictReader(file))
    sources, points = [], []
    for source_id, (media_id, table, first, last) in SOURCE.items():
        url = f"https://www.aamc.org/media/{media_id}/download" + ("?attachment=" if table=="A-9" else "")
        selected = [r for r in audited if r["source_id"] == source_id]
        rows = {int(r["year"]): tuple(int(r[k]) for k in ("black_male", "black_female", "denominator")) for r in selected}
        date = selected[0]["reviewed_on"]
        if download:
            try:
                updated = parse_pdf(get_bytes(url), table, first)
                rows = {year: updated[year] for year in rows}
                date = TODAY
            except (OSError, ValueError, subprocess.CalledProcessError) as exc:
                if strict:
                    raise
                warnings.append(f"{source_id}: original unavailable ({exc}); using cell review from {date}")
        definition = A9 if table == "A-9" else A12
        if table == "A-12":
            title = ("Applicants, First-Time Applicants, Acceptees, and Matriculants to U.S. "
                     "MD-Granting Medical Schools by Race/Ethnicity (Alone) and Gender")
        else:
            schools = "U.S. MD-Granting Medical Schools" if last >= 2022 else "U.S. Medical Schools"
            field = "Gender" if last >= 2022 else "Sex"
            title = (f"Matriculants to {schools} by Race, Selected Combinations of "
                     f"Race/Ethnicity and {field}")
        title = f"FACTS Table {table}: {title}, {first}-{first+1} through {last}-{last+1}"
        source = {
            "id": source_id, "publisher": "Association of American Medical Colleges",
            "table_name": title, "url": url, "retrieved_on": date, "definition": definition,
            "license": "© AAMC. Educational, noncommercial reuse with attribution.",
            "professions": ["physician"],
            "locator": ("Rows “Black or African American Only” and “Total Matriculants”; use the total across genders." if table == "A-9" else "“Black or African American” in Men and Women; All → Total, Matriculants column for each year."),
        }
        sources.append(source)
        for yr, values in sorted(rows.items()):
            points.extend(entry_points("physician", "aamc-matriculants", "Medical school matriculants",
                         "aamc-a9-reported" if table == "A-9" else "aamc-a12-all", yr, source, *values))
    return {"sources": sources, "series": points, "notes": [
        "AAMC asked applicants to verify race responses in 2016 after a data-collection problem.",
        "The A-12 denominator includes all genders beginning with the 2020 observations in this collection. Published values from A-9 and A-12 are separate segments.",
        "These are matriculants at U.S. MD programs. DO programs, medical graduates, residents and practicing physicians are outside this measure."
    ]}
