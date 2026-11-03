"""National workforce tabulations from ACS PUMS and opt-in IPUMS CPS extracts.

python3 loaders/workforce.py acs --cache /tmp/pipeline-census
python3 loaders/workforce.py eeo1990 --cache /tmp/pipeline-census
python3 loaders/workforce.py ipums --extract extract.csv.gz --mapping mapping.csv \
  --citation-url <official-extract-DOI> --title "Basic Monthly CPS extract, version …" \
  --retrieved-on YYYY-MM-DD

IPUMS accepts an unfiltered national Basic Monthly CSV with the published decimal
scale already applied to person weights. Include YEAR, MONTH, CPSIDP,
EMPSTAT, AGE, SEX, RACE, WTFINL, ASECFLAG and OCC2010. Supply a reviewed mapping CSV with
profession_id,occ2010,start_year,end_year,occupation_label. Ranges must fall wholly
within one occupation coding regime. Publish the mapping and extract citation,
never the licensed microdata. Missing months stop the refresh.
"""
import argparse
import csv
import datetime as dt
import gzip
import hashlib
import io
import json
import math
import os
import re
import subprocess
import shutil
import tempfile
import urllib.request
import zipfile
from collections import defaultdict
from concurrent.futures import ProcessPoolExecutor
from pathlib import Path
from urllib.parse import urlparse

ROOT = Path(__file__).resolve().parents[1]
DEFAULT_YEARS = tuple(range(2006, 2020)) + (2021, 2022, 2023, 2024)
MIN_GROUP_SAMPLE = 10
GROUPS = {1: 'black_male', 2: 'black_female'}
FTP = 'https://www2.census.gov/programs-surveys/acs'
ACS_BASE = ('Black or African American alone (RAC1P=2), any Hispanic origin or birthplace. '
            'Denominator: all U.S. civilian employed people age 16+ in this occupation '
            '(ESR=1 or 2; 50 states and DC). Weighted by ACS person weight PWGTP.')
# OCCP on the public-use file sometimes combines multiple detailed SOC occupations.
# These definitions describe the actual tabulation, not an inferred finer subgroup.
OCCUPATIONS = {
    'physician': ('Physicians, excluding surgeons and physician assistants', ('3090',)),
    'engineer': ('Engineers, SOC 17-2000; excludes technicians and engineering managers',
                 ('1320', '1340', '1350', '1360', '1400', '1410', '1420', '1430',
                  '1440', '1450', '1460', '1520', '1530')),
    'dentist': ('Dentists, all specialties', ('3010',)),
    'pharmacist': ('Pharmacists', ('3050',)),
    'registered-nurse': ('Registered nurses; excludes advanced practice nursing occupations', ('3255',)),
    'professor': ('Postsecondary teachers of all academic ranks', ('2205',)),
    'k12-teacher': ('Elementary, middle and secondary school teachers; excludes preschool, '
                    'kindergarten, and separately classified special education teachers', ('2310', '2320')),
    'journalist': ('News analysts, reporters and journalists', ('2810',)),
    'musician': ('Musicians and singers', ('2752',)),
    'police-officer': ('Police officers', ('3870',)),
    'electrician': ('Electricians; excludes helpers and other trades', ('6355',)),
    'software-engineer': ('Software developers', ('1021',)),
}
ACS_LIMITS = ('Survey estimates have sampling error. A point is withheld below ten unweighted '
              'observations in the reported subgroup. Margins of error use the 80 ACS replicate '
              'weights and 90% confidence. No standard ACS one-year release was issued in 2020.')
CPS_REGIMES = ((1990, 1991), (1992, 2002), (2003, 2010), (2011, 2019), (2020, 9999))


def atomic_json(path, value):
    path.parent.mkdir(parents=True, exist_ok=True)
    with tempfile.NamedTemporaryFile(mode='w', dir=path.parent, delete=False) as out:
        json.dump(value, out, ensure_ascii=False, indent=2, allow_nan=False)
        out.write('\n')
    os.chmod(out.name, 0o644)
    os.replace(out.name, path)


def fetch(url, path, refresh=False):
    if path.is_file() and not refresh:
        return
    path.parent.mkdir(parents=True, exist_ok=True)
    with tempfile.NamedTemporaryFile(dir=path.parent, delete=False) as dest:
        try:
            with urllib.request.urlopen(url, timeout=150) as stream:
                shutil.copyfileobj(stream, dest)
        except BaseException:
            Path(dest.name).unlink(missing_ok=True)
            raise
    os.replace(dest.name, path)


def digest(path):
    with path.open('rb') as src:
        return hashlib.file_digest(src, 'sha256').hexdigest()


def occupation_vintage(year):
    if year >= 2018:
        return OCCUPATIONS
    old = OCCUPATIONS.copy()
    old.update({
        'physician': ('Physicians and surgeons combined', ('3060',)),
        'software-engineer': ('Applications and systems software developers' if year >= 2010
                              else 'Computer software engineers', ('1020',)),
        'professor': ('Postsecondary teachers of all academic ranks', ('2200',)),
        'musician': ('Musicians, singers and related workers', ('2750',)),
        'journalist': ('News analysts, reporters and correspondents', ('2810',)),
        'police-officer': ('Police officers', ('3850',)),
        'electrician': ('Electricians', ('6355' if year >= 2010 else '6350',)),
    })
    if year < 2010:
        old['registered-nurse'] = ('Registered nurses under the pre-2010 occupation coding', ('3130',))
    return old


def year_dictionary(year, cache, refresh=False):
    directory = f'{FTP}/tech_docs/pums/data_dict'
    extension = 'csv' if year >= 2017 else 'txt' if year >= 2013 else 'pdf'
    name = (f'PUMS_Data_Dictionary_{year}.{extension}' if year >= 2017 else
            f'PUMSDataDict{year % 100:02}.{extension}')
    url, path = f'{directory}/{name}', cache / f'dict{year}.{extension}'
    fetch(url, path, refresh)
    if extension == 'csv':
        with path.open(encoding='latin-1', newline='') as file:
            codes = {row[4]: row[6] for row in csv.reader(file)
                     if len(row) >= 7 and row[:2] == ['VAL', 'OCCP']}
    else:
        content = (subprocess.check_output(['pdftotext', '-layout', str(path), '-']).decode()
                   if extension == 'pdf' else path.read_text(encoding='latin-1'))
        section = re.search(r'^OCCP[ \t]*4[ \t]*$(.+?)(?=^PAOC[ \t]*\d+[ \t]*$)', content, re.M | re.S)
        if not section:
            raise ValueError(f'{year}: OCCP labels missing from legacy dictionary')
        codes = dict(re.findall(r'^\s*(\d{4})\s+\.([^\n]+)', section[1], re.M))
    if year == 2009:
        # The original US 2009 CSV uses the earlier electrician OCCP, while the
        # posted 2009 dictionary lists 6355. It does document SOC 47-2111. Use
        # that SOC as the actual selection field for this category in this year.
        if not re.search(r'^\s*472111\s+\.CON-ELECTRICIANS', content, re.M | re.I):
            raise ValueError('2009 dictionary no longer documents electrician SOCP 472111')
        codes['6350'] = 'CON-ELECTRICIANS (verified from within-record SOCP 472111)'
    for slug, (_, values) in occupation_vintage(year).items():
        if not all(code in codes for code in values):
            raise ValueError(f'{year}: dictionary does not support {slug}: {values}')
    return url, codes


def acs_family(year, slug):
    if slug == 'k12-teacher':
        return 'acs-school-teachers', 'Workforce: elementary to secondary teachers'
    if year < 2018 and slug == 'physician':
        return 'acs-physicians-surgeons', 'Workforce: physicians and surgeons'
    if year < 2018 and slug == 'musician':
        return 'acs-music-related', 'Workforce: musicians and related workers'
    if year < 2010 and slug == 'registered-nurse':
        return 'acs-nursing-legacy', 'Workforce: nurses (older occupation definition)'
    return 'acs-employed', 'Employed workforce'


def vintage_segment(year):
    for start, end in ((2006, 2009), (2010, 2017), (2018, 2019), (2021, 2024)):
        if start <= year <= end:
            return f'{start}-{end}'
    raise ValueError(f'Unreviewed year {year}')


def acs_segment(year, definition):
    # Include the published definition: a within-vintage crosswalk correction
    # must never become part of an otherwise continuous line.
    signature = hashlib.sha256(definition.encode('utf-8')).hexdigest()[:16]
    return f'{vintage_segment(year)}-{signature}'


def rows_from_pums(archive):
    members = sorted(item for item in archive.namelist()
                     if re.fullmatch(r'(?:psam_pus|ss\d{2}pus)[a-d]?\.csv', Path(item).name, re.I))
    partition_names = {Path(name).name.lower() for name in members}
    complete = any(name.endswith('pus.csv') or
                   (name.endswith('pusa.csv') and name.replace('pusa.csv', 'pusb.csv') in partition_names)
                   for name in partition_names)
    if not complete:
        raise ValueError('A complete set of national ACS person partitions is required')
    for member in members:
        with archive.open(member) as raw:
            with io.TextIOWrapper(raw, encoding='utf-8-sig', newline='') as decoded:
                reader = csv.reader(decoded)
                fields = [field.strip().upper() for field in next(reader)]
                yield fields, reader


def tabulate_acs(archive, occupation_map, year=None):
    # Three rows per occupation (all workers, Black male, Black female).
    # Each row stores unweighted n, the person weight and 80 replicate weights.
    totals = defaultdict(lambda: [[0] * 82 for _ in range(3)])
    for columns, people in rows_from_pums(archive):
        age, employment, occupation, race, sex = [columns.index(k) for k in
                                                    ('AGEP', 'ESR', 'OCCP', 'RAC1P', 'SEX')]
        soc = columns.index('SOCP') if year == 2009 else None
        weights = [columns.index('PWGTP')] + [columns.index(f'PWGTP{i}') for i in range(1, 81)]
        for row in people:
            slug = occupation_map.get(row[occupation].strip().zfill(4))
            if soc is not None and (slug == 'electrician') != (row[soc].strip() == '472111'):
                raise ValueError('2009 electrician OCCP and verified SOCP disagree')
            if not slug or row[employment].strip() not in ('1', '2') or int(row[age]) < 16:
                continue
            values = [1] + [int(row[i]) for i in weights]
            group = int(row[sex]) if int(row[race]) == 2 else 0
            totals[slug][0] = list(map(int.__add__, totals[slug][0], values))
            if group:
                totals[slug][group] = list(map(int.__add__, totals[slug][group], values))
    return totals


def point(slug, sex, year, num, den, size, num_size, family, definition, source_id, segment):
    return {'profession_id': slug, 'measure': 'share_of_profession', 'group': GROUPS[sex],
            'measure_label': 'Employed workforce', 'family': family, 'unit': 'percent',
            'year': year, 'value': round(num / den * 100, 6), 'definition': definition,
            'source_id': source_id, 'series_id': f'{family}-{slug}-{GROUPS[sex]}-{segment}',
            'weighted_numerator': num, 'weighted_denominator': den,
            'unweighted_group_n': num_size, 'unweighted_denominator_n': size}


def acs_year(job):
    year, cache, refresh, selection = job
    if year not in DEFAULT_YEARS:
        raise ValueError(f'{year}: unreviewed occupation vintage or nonstandard ACS release')
    directory = f'{FTP}/data/pums/{year}/' + ('1-Year/' if year > 2006 else '')
    zip_url = f'{directory}csv_pus.zip'
    zip_path = cache / f'acs{year}.zip'
    fetch(zip_url, zip_path, refresh)
    retrieved = dt.date.fromtimestamp(zip_path.stat().st_mtime).isoformat()
    dict_url, labels = year_dictionary(year, cache, refresh)
    occupations = {s: entry for s, entry in occupation_vintage(year).items()
                   if not selection or s in selection}
    occupation_map = {code: slug for slug, (_, codes) in occupations.items() for code in codes}
    with zipfile.ZipFile(zip_path) as archive:
        totals = tabulate_acs(archive, occupation_map, year if 'electrician' in occupations else None)
    if set(totals) != occupations.keys():
        raise ValueError(f'Missing profession from national file: {occupations.keys() - totals.keys()}')
    sources, series = [], []
    checksum = digest(zip_path)
    for slug, (label, codes) in occupations.items():
        source_id = f'acs-{year}-{slug}'
        definition = f'{label}. {ACS_BASE} OCCP: {", ".join(codes)}.'
        if year == 2009 and slug == 'electrician':
            definition += ' Underlying occupation verified against SOCP 472111 on every person record.'
        source = {'id': source_id, 'publisher': 'U.S. Census Bureau', 'professions': [slug],
                  'table_name': f'{year} ACS 1-year PUMS, U.S. person file • {label} by race and sex',
                  'url': directory, 'data_url': zip_url,
                  'dictionary_url': dict_url, 'license': 'U.S. government public-use data',
                  'retrieved_on': retrieved, 'definition': definition, 'limits': ACS_LIMITS,
                  'file_sha256': checksum, 'occupation_labels': [labels[c] for c in codes]}
        sources.append(source)
        den = totals[slug][0]
        for sex in GROUPS:
            num = totals[slug][sex]
            if num[0] < MIN_GROUP_SAMPLE:
                continue
            family, measure_label = acs_family(year, slug)
            p = point(slug, sex, year, num[1], den[1], den[0], num[0], family,
                      definition, source_id, acs_segment(year, definition))
            p['measure_label'] = measure_label
            replicate_shares = [100 * n / d for n, d in zip(num[2:], den[2:])]
            share = 100 * num[1] / den[1]
            p['moe90_pp'] = round(1.645 * math.sqrt(4 / 80 *
                                    sum((rep - share) ** 2 for rep in replicate_shares)), 5)
            series.append(p)
    print(f'{year}: {len(series)} workforce estimates', flush=True)
    return sources, series


def run_acs(args):
    years = sorted(set(args.years))
    jobs = [(year, args.cache, args.refresh, args.profession) for year in years]
    with ProcessPoolExecutor(max_workers=min(len(jobs), args.jobs)) as pool:
        result = list(pool.map(acs_year, jobs))
    return {'sources': [s for sources, _ in result for s in sources],
            'series': [row for _, series in result for row in series],
            'notes': [ACS_LIMITS, 'Occupation mappings are validated against each release dictionary. '
                      'The ACS public-use legal occupation combines lawyers with judges and magistrates, '
                      'so it is not reported as a lawyers-only workforce series.']}


EEO_REPORT = 'https://www2.census.gov/library/publications/decennial/1990/cp-s-1-1.pdf'
EEO_ROWS = {
    'physician': ('Physicians',), 'lawyer': ('Lawyers',), 'engineer': ('Engineers',),
    'dentist': ('Dentists',), 'pharmacist': ('Pharmacists',), 'registered-nurse': ('Registered nurses',),
    'professor': ('Teachers, postsecondary',),
    'k12-teacher': ('Teachers, elementary school', 'Teachers, secondary school'), 'journalist': ('Editors and reporters',),
    'musician': ('Musicians and composers',),
    'electrician': ('Electricians, except apprentices', 'Electrician apprentices'),
}
EEO_LIMITS = ('The 1990 census used a single reported race. This civilian labor force table '
              'includes people looking for work with a recent occupation. Occupation groups and the '
              'employment universe differ from the ACS workforce series.')


def eeo_counts(pages, label):
    row_pattern = re.compile(r'^\s*' + re.escape(label) + r'\s*-{2,}\s+(.*?)\s*$', re.M)
    matches = []
    for number, page in enumerate(pages, start=1):
        if not re.search(r'Table 2\.\s+Detailed Occupation of the Civilian Labor Force by Sex and Race: 1990', page):
            continue
        for match in row_pattern.finditer(page):
            cells = re.split(r'\s{2,}', match.group(1))
            if len(cells) != 12:
                raise ValueError(f'1990 Table 2 layout changed on page {number}, row {label!r}')
            columns = [0 if cell == '–' else int(cell.replace(' ', '')) for cell in cells]
            # All five race columns must sum to each of the sex-specific totals.
            if columns[0] != sum(columns[2::2]) or columns[1] != sum(columns[3::2]):
                raise ValueError(f'1990 Table 2 column check failed for {label}')
            matches.append((number, columns))
    if len(matches) != 1:
        raise ValueError(f'Expected a unique 1990 Table 2 row for {label}: found {len(matches)}')
    return matches[0]


def run_eeo(args):
    archive = args.cache / 'eeo1990.pdf'
    fetch(EEO_REPORT, archive, args.refresh)
    retrieved = dt.date.fromtimestamp(archive.stat().st_mtime).isoformat()
    sha = digest(archive)
    pdftotext = shutil.which('pdftotext')
    if not pdftotext:
        raise ValueError('Refreshing the 1990 Census EEO table requires Poppler pdftotext.')
    pages = subprocess.check_output([pdftotext, '-enc', 'UTF-8', '-layout', str(archive), '-']).decode().split('\f')
    sources, series = [], []
    for slug, labels in EEO_ROWS.items():
        citations = [eeo_counts(pages, label) for label in labels]
        first_page = citations[0][0]
        total = sum(cols[0] + cols[1] for _, cols in citations)
        sid = f'census-eeo-1990-{slug}'
        label = ' + '.join(labels)
        definition = (f'{label}. People age 16+ in the U.S. civilian labor force classified in the '
                      f'named occupation, including experienced unemployed. Black, single reported '
                      f'race, any Hispanic origin or birthplace. Share of all people in those rows, '
                      f'male and female combined. Published decennial sample estimates.')
        if slug == 'k12-teacher':
            definition += ' This elementary and secondary subset excludes separately classified school teachers.'
        sources.append({'id': sid, 'publisher': 'U.S. Census Bureau', 'table_name':
                        f'1990 Census EEO CP-S-1-1, Table 2, “{label}” (PDF page {first_page})',
                        'url': f'{EEO_REPORT}#page={first_page}', 'retrieved_on': retrieved,
                        'license': 'U.S. government public-use data', 'definition': definition,
                        'professions': [slug], 'file_sha256': sha, 'limits': EEO_LIMITS})
        for sex, col in ((1, 4), (2, 5)):
            num = sum(cols[col] for _, cols in citations)
            family = 'eeo-1990-school-teachers' if slug == 'k12-teacher' else 'eeo-1990-labor-force'
            measure_label = ('Elementary and secondary teachers (1990)' if slug == 'k12-teacher' else
                             'Civilian labor force (1990)')
            series.append({'profession_id': slug, 'measure': 'share_of_profession', 'group': GROUPS[sex],
                           'measure_label': measure_label, 'family': family, 'unit': 'percent',
                           'year': 1990, 'value': round(num / total * 100, 6), 'definition': definition,
                           'source_id': sid, 'series_id': f'{family}-{slug}-{GROUPS[sex]}',
                           'weighted_numerator': num, 'weighted_denominator': total})
    return {'sources': sources, 'series': series, 'notes': [EEO_LIMITS]}


def ipums_mapping(path):
    mapping = {}
    with path.open(encoding='utf-8-sig', newline='') as f:
        for item in csv.DictReader(f):
            start, end = int(item['start_year']), int(item['end_year'])
            if end < start or end > dt.date.today().year or not any(a <= start <= end <= b for a, b in CPS_REGIMES):
                raise ValueError(f'Invalid date range or crosses CPS occupation coding change: {item}')
            code = int(item['occ2010'])
            if not 1 <= code <= 9900 or not item['occupation_label'].strip():
                raise ValueError(f'Invalid OCC2010 mapping: {item}')
            for year in range(start, end + 1):
                if (year, code) in mapping:
                    raise ValueError(f'Duplicate occupation/year mapping for {year}, {code}')
                mapping[year, code] = (item['profession_id'], item['occupation_label'].strip())
    if not mapping:
        raise ValueError('Supply an independently reviewed OCC2010 mapping.')
    return mapping


def run_ipums(args):
    # Repeated monthly respondents are legitimate person-months. The denominator
    # is the weighted average monthly workforce over a complete calendar year.
    parsed = urlparse(args.citation_url)
    if parsed.scheme != 'https' or parsed.hostname not in ('doi.org', 'cps.ipums.org'):
        raise ValueError('Supply an official IPUMS dataset citation URL.')
    taxonomy = json.loads((ROOT / 'data/professions.json').read_text())
    valid_slugs = {item['slug'] for item in taxonomy}
    mapping = ipums_mapping(args.mapping)
    if any(slug not in valid_slugs for slug, _ in mapping.values()):
        raise ValueError('Unknown profession in mapping')
    signature = digest(args.mapping)
    sample_hash = digest(args.extract)
    counts, months = defaultdict(lambda: [[0, 0.] for _ in range(3)]), defaultdict(set)
    opener = gzip.open if args.extract.suffix == '.gz' else open
    with opener(args.extract, 'rt', encoding='utf-8-sig', newline='') as f:
        reader = csv.DictReader(f)
        req = {'YEAR', 'MONTH', 'CPSIDP', 'EMPSTAT', 'AGE', 'SEX', 'RACE', 'WTFINL', 'OCC2010', 'ASECFLAG'}
        if not req.issubset(reader.fieldnames or []):
            raise ValueError(f'Missing IPUMS Basic Monthly fields: {sorted(req.difference(reader.fieldnames or []))}')
        seen = set()
        for row in reader:
            year, month = int(row['YEAR']), int(row['MONTH'])
            if (row['ASECFLAG'].strip() == '1' or
                    (month == 3 and row['ASECFLAG'].strip() != '2')):
                raise ValueError('Use only Basic Monthly files, not an ASEC supplement or unidentified March sample')
            months[year].add(month)
            if int(row['EMPSTAT']) not in (10, 12) or int(row['AGE']) < 16:
                continue
            match = mapping.get((year, int(row['OCC2010'])))
            if not match:
                continue
            key = (year, month, row['CPSIDP'])
            if int(row['CPSIDP']) <= 0 or key in seen:
                raise ValueError(f'Invalid or duplicate CPS person-month in {year}-{month:02}')
            seen.add(key)
            weight = float(row['WTFINL'])
            if not math.isfinite(weight) or weight < 0:
                raise ValueError('Invalid WTFINL')
            if not weight:
                continue
            sex = int(row['SEX'])
            if sex not in GROUPS:
                raise ValueError('Unrecognized sex code')
            bucket = counts[match[0], year]
            group = sex if int(row['RACE']) == 200 else 0
            for g in ((0, group) if group else (0,)):
                bucket[g][0] += 1
                bucket[g][1] += weight
    for year, covered in months.items():
        if covered != set(range(1, 13)):
            raise ValueError(f'{year}: missing Basic Monthly samples, cannot label as full annual estimate')
    if not counts:
        raise ValueError('No eligible person-months matched the supplied mapping')
    sources, series = [], []
    for (slug, year), bucket in sorted(counts.items()):
        pairs = sorted((code, label) for (y, code), (s, label) in mapping.items() if y == year and s == slug)
        code_note = ', '.join(f'{code:04}: {label}' for code, label in pairs)
        race = ('Black, single race recorded' if year < 2003 else
                'Black alone, multiple race responses allowed')
        definition = (f'{race} (RACE=200), any origin or birthplace. U.S. civilian employed '
                      f'age 16+ (EMPSTAT=10 or 12); all workers in mapped occupation denominator. '
                      f'12 Basic Monthly samples weighted by person weight WTFINL; '
                      f'annual average of monthly weighted counts. OCC2010: {code_note}.')
        sid = f'ipums-basic-{slug}-{year}'
        sources.append({'id': sid, 'publisher': 'IPUMS CPS', 'table_name': f'{args.title} • {year} • {code_note}',
                        'url': args.citation_url, 'retrieved_on': args.retrieved_on, 'professions': [slug],
                        'definition': definition, 'license': 'IPUMS CPS terms of use; derived aggregates only',
                        'mapping_sha256': signature, 'extract_sha256': sample_hash,
                        'weight_documentation': 'https://cps.ipums.org/cps-action/variables/WTFINL'})
        segment = next(a for a, b in CPS_REGIMES if a <= year <= b)
        codesig = hashlib.sha256(code_note.encode()).hexdigest()[:10]
        n, total = bucket[0]
        for sex in GROUPS:
            cell_n, cell = bucket[sex]
            if cell_n >= MIN_GROUP_SAMPLE:
                series.append(point(slug, sex, year, cell / 12, total / 12, n, cell_n, 'ipums-cps-employed',
                                    definition, sid, f'{segment}-{codesig}'))
    return {'sources': sources, 'series': series,
            'notes': ['IPUMS weights are person-month weights. Average monthly counts divide the sum by 12. '
                      'Sample n counts observations; people may recur across months. '
                      'No CPS confidence intervals have been computed. Annual group cells below ten '
                      'unweighted observations are suppressed. RACE changed in 2003.']}


def main():
    parser = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    sub = parser.add_subparsers(dest='command', required=True)
    acs = sub.add_parser('acs')
    acs.add_argument('--cache', type=Path, required=True)
    acs.add_argument('--refresh', action='store_true', help='Download a fresh copy from the publisher')
    acs.add_argument('--years', type=int, nargs='+', default=DEFAULT_YEARS, choices=DEFAULT_YEARS)
    acs.add_argument('--jobs', type=int, choices=range(1, 5), default=3)
    acs.add_argument('--profession', nargs='+', choices=sorted(OCCUPATIONS), help='Subset for independent QA')
    acs.add_argument('--output', type=Path, default=ROOT / 'data/imports/workforce.json')
    eeo = sub.add_parser('eeo1990')
    eeo.add_argument('--cache', type=Path, required=True)
    eeo.add_argument('--refresh', action='store_true', help='Download a fresh copy from the publisher')
    eeo.add_argument('--output', type=Path, default=ROOT / 'data/imports/eeo1990.json')
    ipums = sub.add_parser('ipums')
    ipums.add_argument('--extract', type=Path, required=True)
    ipums.add_argument('--mapping', type=Path, required=True)
    ipums.add_argument('--citation-url', required=True)
    ipums.add_argument('--title', required=True)
    ipums.add_argument('--retrieved-on', type=lambda s: dt.date.fromisoformat(s).isoformat(), required=True)
    ipums.add_argument('--output', type=Path, default=ROOT / 'data/imports/ipums.json')
    args = parser.parse_args()
    tasks = {'acs': run_acs, 'eeo1990': run_eeo, 'ipums': run_ipums}
    atomic_json(args.output, tasks[args.command](args))


if __name__ == '__main__':
    main()
