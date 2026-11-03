"""Refresh DoD Table B-25. Extract only the serving commissioned officer corps."""
from concurrent.futures import ThreadPoolExecutor
from html.parser import HTMLParser
from pathlib import Path
from urllib.parse import quote
import json
import re
import subprocess
import tempfile

from education_common import TODAY, get_bytes

OUT = Path(__file__).resolve().parents[1] / "data/imports/supplement.json"
GROUPS = {"males and females": "all", "men and women": "all", "male and female": "all",
          "males": "men", "men": "men", "male": "men", "females": "women",
          "women": "women", "female": "women"}


def link(year):
    if year < 2020:
        return f"https://www.cna.org/pop-rep/{year}/appendixb/b_25.html"
    yy = str(year)[-2:]
    prefix = "https://docs.opa.mil/opa.mil-production1/population-representation"
    base = prefix + ("" if year == 2020 else "-" + yy) + "/"
    folder = ("Appendix B" + ("_" if year == 2020 else ". ") +
              "Active Component Enlisted Accessions, Enlisted Force, Officer Accessions, and Officer Corps Tables/")
    name = (f"Table B-25. Active Component Commissioned Officer Gains and Corps, FY{yy}" +
            (":" if year == 2022 else "-") + " By Service, " +
            ("Sex" if year == 2023 else "Gender") +
            ", and Race_Ethnicity with Civilian Comparison Groups.pdf")
    return base + quote(folder + name, safe="/")


class Rows(HTMLParser):
    def __init__(self):
        super().__init__()
        self.rows = []
        self.row = []
        self.cell = None

    def handle_starttag(self, tag, attrs):
        if tag == "tr":
            self.row = []
        elif tag in ("td","th"):
            self.cell = []

    def handle_data(self, data):
        if self.cell is not None:
            self.cell.append(data)

    def handle_endtag(self, tag):
        if tag in ("td","th") and self.cell is not None:
            self.row.append(" ".join("".join(self.cell).split()))
            self.cell = None
        elif tag == "tr" and self.row:
            self.rows.append(self.row)


def html_counts(raw):
    parser = Rows()
    parser.feed(raw.decode("cp1252",errors="replace"))
    counts = {}
    corps = False
    group = None
    for row in parser.rows:
        field = row[0].lower()
        if re.fullmatch(r"officer corps\s*\d*", field):
            corps = True
        if field in GROUPS:
            group = GROUPS[field]
        elif "distributed" in field:
            group = None
        if corps and group and field in ("black","total") and len(row) > 13:
            # Four services, Total DoD, and civilian comparison. Check the sum
            # of service counts against the DoD column before retaining the value.
            if not row[13]:
                continue
            count = int(row[13].replace(",",""))
            service_sum = sum(int(row[i].replace(",","")) for i in (1,4,7,10))
            if count != service_sum:
                raise ValueError("Total DoD does not match service counts")
            counts[group,field] = count
    return checked(counts)


def checked(counts):
    for key in ("black","total"):
        if counts["men",key] + counts["women",key] != counts["all",key]:
            raise ValueError("Officer totals disagree across gender panels")
    if not 0 < counts["all","black"] < counts["all","total"]:
        raise ValueError("Invalid officer counts")
    return counts["men","black"], counts["women","black"], counts["all","total"]


def pdf_counts(raw,year):
    with tempfile.TemporaryDirectory() as tmp:
        path = Path(tmp,"table.pdf")
        path.write_bytes(raw)
        txt = subprocess.check_output(["pdftotext","-layout",str(path),"-"],text=True)
    counts = {}
    for page in txt.split("\f"):
        if not re.search(r"^\s*Officer Corps\s{2,}",page,re.M):
            continue
        header = re.search(r"^\s*(Male and Female|Males and Females|Men and Women|Male|Female|Males|Females|Men|Women)\s+#",page,re.M)
        if not header: # normalized percentages that redistribute unknown race
            continue
        group = GROUPS[header[1].lower()]
        for label in ("Black","TOTAL"):
            match = re.search(r"^\s*"+label+r"\s+(\d[^\n]+)",page,re.M|re.I)
            nums = match[1].split() if match else []
            nservices = 4 if year <= 2021 else 5
            if len(nums) != (nservices + 2)*2:
                raise ValueError(f"Unrecognized {year} table column count")
            service_counts = [int(nums[2*i].replace(",","")) for i in range(nservices)]
            total = int(nums[-4].replace(",",""))
            if total != sum(service_counts):
                raise ValueError("DoD total disagrees with service counts")
            counts[group,label.lower()] = total
    return checked(counts)


def one_year(year):
    url = link(year)
    data = get_bytes(url)
    male, female, total = html_counts(data) if year < 2020 else pdf_counts(data,year)
    # The last two editions change service or multiracial reporting. Do not
    # connect across either change even though the table label stays the same.
    segment = "four-services" if year <= 2021 else ("five-services" if year==2022 else "army-multiracial")
    scope = ("Army, Navy, Marine Corps and Air Force" if year < 2022 else
             "Army, Navy, Marine Corps, Air Force and Space Force")
    caveat = ("The Army did not report a multiracial category." if year < 2023 else
              "The Army reports multiracial officers separately in this edition.")
    definition = ("Black is the published race category, with Hispanic ethnicity tabulated separately. "
                  f"Men or women divided by all active-component commissioned officers in the {scope} "
                  f"at fiscal year-end. Reserve, warrant and Coast Guard officers are outside the denominator. {caveat}")
    source = {"id":f"dod-corps-{year}", "publisher":"U.S. Department of Defense",
              "table_name":f"Population Representation in the Military Services · FY {year} · Table B-25, Active Component Commissioned Officer Gains and Corps",
              "url":url,"retrieved_on":TODAY,"license":"U.S. government statistical table.",
              "definition":definition,"professions":["military-officer"],
              "locator":"Officer Corps panels (not Officer Gains), Total DoD number column. Use unadjusted Black rows for men/women and the combined corps total."}
    pts = [{"profession_id":"military-officer","family":"dod-officers","measure":"share_of_profession",
            "group":g,"year":year,"value":round(n/total*100,6),"unit":"percent",
            "definition":definition,"source_id":source["id"],"series_id":f"dod-{segment}-{g}",
            "measure_label":"Active-duty commissioned officers","numerator":n,"denominator":total}
           for g,n in (("black_male",male),("black_female",female))]
    return source,pts


def main():
    with ThreadPoolExecutor(max_workers=3) as pool:
        results = list(pool.map(one_year,range(2014,2024)))
    output = {"sources":[r[0] for r in results],"series":[p for _,pts in results for p in pts],
              "notes":["DoD reports the active-component commissioned corps separately from warrant officers, new officer gains, reserve officers and the Coast Guard. The Space Force is shown separately from 2022. The Army begins reporting the multiracial category in the 2023 edition."]}
    OUT.parent.mkdir(exist_ok=True, parents=True)
    with tempfile.NamedTemporaryFile(dir=OUT.parent,mode="w",delete=False,encoding="utf-8") as file:
        json.dump(output,file,indent=2,ensure_ascii=False)
        file.write("\n")
    Path(file.name).replace(OUT)
    print(f"{len(results)} military tables, {len(output['series'])} observations")


if __name__ == "__main__":
    main()
