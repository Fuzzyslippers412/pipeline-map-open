"""Read the ABA's national Standard 509 compilation behind its public download button."""
import csv
import io
import re
from concurrent.futures import ThreadPoolExecutor
from pathlib import Path
from urllib.parse import urlencode
from xml.etree import ElementTree as ET
from zipfile import BadZipFile, ZipFile

from education_common import TODAY, entry_points, get_bytes

BASE = "https://backend.abarequireddisclosures.org/api/AnnualQuestionnaire/GetAllCompilationData"
SECTION = "JD Enrollment and Ethnicity"
REVIEWED = Path(__file__).parent / "reviewed" / "aba-cells.csv"
NS = "{http://schemas.openxmlformats.org/spreadsheetml/2006/main}"
REPORT_POLICY = ("https://www.americanbar.org/content/dam/aba/administrative/"
                 "legal_education_and_admissions_to_the_bar/2025/council-meeting/"
                 "12-generic-std-509-info-report-2025-clean-version.pdf")


def report_url(year):
    # scetionName is spelled this way in the publisher's public download form.
    return BASE + "?" + urlencode({"year": year, "scetionName": SECTION})


def sheet_rows(data):
    # The first sheet of these publisher workbooks contains one row per school.
    with ZipFile(io.BytesIO(data)) as workbook:
        strings = []
        if "xl/sharedStrings.xml" in workbook.namelist():
            root = ET.fromstring(workbook.read("xl/sharedStrings.xml"))
            strings = ["".join(n.text or "" for n in si.iter(NS+"t")) for si in root]
        root = ET.fromstring(workbook.read("xl/worksheets/sheet1.xml"))
        for row in root.findall(".//"+NS+"row"):
            cells = {}
            for cell in row.findall(NS+"c"):
                col = re.match(r"[A-Z]+", cell.attrib["r"]).group(0)
                v = cell.findtext(NS+"v")
                if cell.get("t") == "s":
                    v = strings[int(v)]
                elif cell.get("t") == "inlineStr":
                    v = "".join(n.text or "" for n in cell.iter(NS+"t"))
                cells[col] = v
            if cells:
                yield cells


def aggregate(data, year):
    rows = iter(sheet_rows(data))
    head = next(rows)
    by_name = {v: k for k, v in head.items()}
    fields = ("BlackMenJD1", "BlackWomenJD1", "TotalJD1Total", "BlackJD1Total")
    if year == 2017:
        fields = ("Black or African American 1L Men", "Black or African American 1L Women",
                  "Total 1L Total", "Black or African American 1L Total")
    required = [by_name[name] for name in fields]
    schools = set()
    summed = [0, 0, 0]
    for row in rows:
        school = row.get("A")
        if not school or school.lower() in schools or school.lower() in ("total", "grand total"):
            raise ValueError(f"Blank, duplicate or aggregate school row for {year}: {school}")
        schools.add(school.lower())
        if "SchoolYear" in by_name and int(row[by_name["SchoolYear"]]) != year:
            raise ValueError("Unexpected report year")
        values = [int(row[column]) for column in required]
        men, women, all_students, all_black = values
        if min(values) < 0 or not men + women <= all_black <= all_students:
            raise ValueError(f"Inconsistent counts for {year}")
        for i in range(3):
            summed[i] += values[i]
    if len(schools) < 150:
        raise ValueError(f"Incomplete all-schools compilation for {year}")
    return (*summed, len(schools))


def load(download, strict, warnings, last_year):
    with REVIEWED.open(newline="") as source:
        reviewed = {int(row["year"]): row for row in csv.DictReader(source)}
    def one_year(year):
        source_id = f"aba-509-jd1-{year}"
        historical = year < 2024
        definition = (
            "Black or African American, with Hispanic and multiracial students classified separately. "
            "Men or women divided by all students in the first-year J.D. cohort (JD1) at schools "
            "in the ABA compilation. This includes continuing first-year students. "
            + ("U.S. nonresidents were classified separately." if historical else
               "Beginning in 2024, U.S. nonresidents are classified by race and ethnicity.")
        )
        cache = reviewed.get(year)
        url = report_url(year)
        if download:
            try:
                values = aggregate(get_bytes(url), year)
                date = TODAY
            except (OSError, ValueError, KeyError, BadZipFile) as exc:
                if strict or cache is None:
                    raise
                warnings.append(f"{source_id}: original unavailable ({exc}); retained verified aggregate")
                values = None
        else:
            values = None
        if values is None:
            if cache is None:
                raise ValueError(f"No reviewed ABA aggregate for {year}. Run refresh with network access.")
            values = [int(cache[k]) for k in ("black_male","black_female","denominator","schools")]
            date = cache["reviewed_on"]
        male, female, total, schools = values
        source = {
            "id": source_id, "publisher": "American Bar Association",
            "table_name": f"Standard 509 · JD Enrollment and Ethnicity · {year} all-schools compilation",
            "url": url, "retrieved_on": date, "license": "© American Bar Association. Public disclosure. Calculations use aggregate counts.",
            "definition": definition, "professions": ["lawyer"], "reference_url": REPORT_POLICY,
            "locator": (f"Sum each column over {schools} school rows in the worksheet. Numerators: Black or African American 1L Men/Women (2017) or BlackMenJD1/BlackWomenJD1. Denominator: Total 1L Total (2017) or TotalJD1Total."),
        }
        points = entry_points("lawyer", "aba-first-year", "First-year J.D. enrollment",
                              "aba-jd1-separate" if historical else "aba-jd1-inclusive", year, source,
                              male, female, total)
        return source, points

    with ThreadPoolExecutor(max_workers=2) as pool:
        results = list(pool.map(one_year, range(2017, last_year+1)))
    return {"sources": [s for s,_ in results], "series": [p for _,rows in results for p in rows],
            "notes": ["Each annual compilation covers its reporting schools. The JD1 cohort includes all first-year students and differs from the separate ABA count of newly entering law students.",
                      "Beginning in 2024, U.S. nonresident students are reported by race/ethnicity instead of in a separate category. The chart starts a new segment."]}
