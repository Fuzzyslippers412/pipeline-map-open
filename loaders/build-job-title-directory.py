"""Refresh local job-title suggestions and occupation links from O*NET 31.0."""
import argparse
import csv
import hashlib
import io
import json
from pathlib import Path
import urllib.request

ROOT = Path(__file__).resolve().parents[1]
BASE = 'https://www.onetcenter.org/dl_files/database/db_31_0_csv/'
FILES = {
    'reported': ('sample_of_reported_titles.csv', {'Reported Job Title': 'reported'},
                 '5d76040b7b0602ea217660648f8363e7980edd1870f96574a2eeaa6a822d2666'),
    'jobs': ('job_titles.csv', {'Job Title': 'alternate', 'Short Title': 'short'},
             '75a3b46d6edc5996117c10c9ed488c9a06f7495d02969e9d12873ab14a21540c'),
}


def write_json(file, value):
    file.write_text(json.dumps(value, ensure_ascii=False, separators=(',', ':')) + '\n')


def build(local_files):
    aliases = {}
    occupations = {}
    source_files = []
    for kind, (name, title_columns, expected) in FILES.items():
        url = BASE + name
        if local_files[kind]:
            content = Path(local_files[kind]).read_bytes()
        else:
            with urllib.request.urlopen(url, timeout=45) as response:
                content = response.read()
        if hashlib.sha256(content).hexdigest() != expected:
            raise ValueError(f'{name} does not match the pinned O*NET 31.0 release')
        table = csv.DictReader(io.StringIO(content.decode('utf-8-sig')))
        columns = ['O*NET-SOC Code', 'Title', *title_columns]
        if kind == 'jobs':
            columns.append('Source(s)')
        if not set(columns).issubset(table.fieldnames or []):
            raise ValueError(f'Unexpected columns in {name}')
        count = 0
        for row in table:
            count += 1
            code = row['O*NET-SOC Code']
            occupations[code] = row['Title']
            for column, origin in title_columns.items():
                title = ' '.join(row[column].split())
                if not 2 <= len(title) <= 120:
                    continue
                _, links = aliases.setdefault(title.casefold(), (title, {}))
                origin_ref = origin
                if kind == 'jobs':
                    origin_ref += ':' + row['Source(s)']
                links.setdefault(code, set()).add(origin_ref)
        source_files.append({'file': name, 'url': url, 'sha256': expected, 'sourceRows': count,
                             'columnsUsed': columns})

    # Encode repeated occupations and source combinations as small indices.
    # Each entry is [display title, occupation index, provenance index, ...].
    codes = {code: i for i, code in enumerate(occupations)}
    origins = {}
    entries = []
    for title, links in aliases.values():
        entry = [title]
        for code, refs in links.items():
            provenance = tuple(sorted(refs))
            entry.extend([codes[code], origins.setdefault(provenance, len(origins))])
        entries.append(entry)
    target = ROOT / 'public' / 'data'
    target.mkdir(parents=True, exist_ok=True)
    write_json(target / 'job-occupations.json', {
        'version': 1, 'occupations': list(occupations.items()),
        'origins': list(origins), 'entries': entries,
    })
    # Older editions read this list of display strings.
    write_json(target / 'job-titles.json', [row[0] for row in entries])
    metadata = {
        'source': 'O*NET® 31.0 Database',
        'publisher': 'U.S. Department of Labor, Employment and Training Administration',
        'database': 'https://www.onetcenter.org/database.html', 'license': 'CC BY 4.0',
        'licenseUrl': 'https://creativecommons.org/licenses/by/4.0/',
        'attribution': 'https://www.onetcenter.org/license_db.html', 'files': source_files,
        'titleCount': len(entries), 'occupationCount': len(occupations),
        'changes': 'Door Notes deduplicates title spellings, retaining all occupation links, title origins and source codes. Historical coverage and related-field labels are Door Notes editorial decisions. USDOL/ETA has not approved, endorsed, or tested these modifications. O*NET® is a trademark of USDOL/ETA.',
    }
    (target / 'job-title-source.json').write_text(json.dumps(metadata, ensure_ascii=False, indent=2) + '\n')
    print(f'{len(entries):,} titles linked to {len(occupations):,} occupations.')


if __name__ == '__main__':
    parser = argparse.ArgumentParser(description=__doc__)
    for key in FILES:
        parser.add_argument('--' + key, help='Read this official release CSV locally instead of downloading')
    build(vars(parser.parse_args()))
