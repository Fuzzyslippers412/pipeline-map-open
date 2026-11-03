"""Refresh local title suggestions from the pinned O*NET 31.0 official CSV release."""
import argparse
import csv
import hashlib
import io
import json
from pathlib import Path
import urllib.request

ROOT = Path(__file__).resolve().parents[1]
BASE = 'https://www.onetcenter.org/dl_files/database/db_31_0_csv/'
FILES = {'reported': ('sample_of_reported_titles.csv', ['Reported Job Title']),
         'jobs': ('job_titles.csv', ['Job Title', 'Short Title'])}


def build(local_files):
    seen = set()
    titles = []
    sources = []
    for kind, (name, columns) in FILES.items():
        url = BASE + name
        if local_files[kind]:
            content = Path(local_files[kind]).read_bytes()
        else:
            with urllib.request.urlopen(url, timeout=45) as response:
                content = response.read()
        table = csv.DictReader(io.StringIO(content.decode('utf-8-sig')))
        if not set(columns).issubset(table.fieldnames or []):
            raise ValueError(f'Unexpected columns in {name}')
        count = 0
        for row in table:
            count += 1
            for col in columns:
                title = ' '.join(row[col].split())
                if len(title) < 2 or len(title) > 120 or title.casefold() in seen:
                    continue
                seen.add(title.casefold())
                titles.append(title)
        if count < 1000:
            raise ValueError(f'Incomplete {name}: {count} rows')
        sources.append({'file': name, 'url': url, 'sha256': hashlib.sha256(content).hexdigest(),
                        'sourceRows': count, 'columnsUsed': columns})
    target = ROOT / 'public' / 'data'
    target.mkdir(parents=True, exist_ok=True)
    output = target / 'job-titles.json'
    output.write_text(json.dumps(titles, ensure_ascii=False, separators=(',', ':')) + '\n')
    metadata = {
        'source': 'O*NET® 31.0 Database', 'publisher': 'U.S. Department of Labor, Employment and Training Administration',
        'database': 'https://www.onetcenter.org/database.html', 'license': 'CC BY 4.0',
        'licenseUrl': 'https://creativecommons.org/licenses/by/4.0/',
        'attribution': 'https://www.onetcenter.org/license_db.html', 'files': sources, 'titleCount': len(titles),
        'changes': 'Door Notes selects job, short and reported titles, removes duplicate spellings, and combines them with its own curated terms at search time. Project labels and profession matches are its own. USDOL/ETA has not approved, endorsed, or tested these modifications. O*NET® is a trademark of USDOL/ETA.'
    }
    (target / 'job-title-source.json').write_text(json.dumps(metadata, ensure_ascii=False, indent=2) + '\n')
    print(f'{len(titles):,} unique titles written to {output.name}')


if __name__ == '__main__':
    parser = argparse.ArgumentParser(description=__doc__)
    for key in FILES:
        parser.add_argument('--' + key, help='Read this official release CSV locally instead of downloading')
    build(vars(parser.parse_args()))
