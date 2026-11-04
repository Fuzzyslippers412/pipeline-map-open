"""Validate the committed snapshots and create a reproducible static data bundle."""
from hashlib import sha256
from urllib.parse import urlparse
import csv
import json
from pathlib import Path
import sqlite3

ROOT = Path(__file__).resolve().parents[1]
DATA = ROOT / 'data'
load = lambda path: json.loads(path.read_text())
professions = load(DATA / 'professions.json')
roles = load(DATA / 'roles.json')
assert len(professions) == len({p['slug'] for p in professions}) == 20
enums = set('hbcu military black_church market union_or_trade civil_rights_law foundation_nonprofit university_dei legacy_media licensing_board electorate nation_of_islam fraternal_order other'.split())
dbfile = DATA / 'pipeline.sqlite'
db = sqlite3.connect(':memory:')
db.execute('pragma foreign_keys = on')
db.executescript("""
CREATE TABLE profession(id TEXT PRIMARY KEY,name TEXT NOT NULL,slug TEXT UNIQUE NOT NULL,soc_code TEXT,aliases TEXT NOT NULL);
CREATE TABLE origin(profession_id TEXT PRIMARY KEY REFERENCES profession, builder TEXT NOT NULL,era TEXT NOT NULL,rationale TEXT NOT NULL,citation_ids TEXT NOT NULL,status TEXT NOT NULL,kind TEXT DEFAULT 'editorial' CHECK(kind='editorial'),era_start INTEGER,era_end INTEGER);
CREATE TABLE gate(profession_id TEXT PRIMARY KEY REFERENCES profession, gatekeeper TEXT NOT NULL,era TEXT NOT NULL,rationale TEXT NOT NULL,citation_ids TEXT NOT NULL,status TEXT NOT NULL,kind TEXT DEFAULT 'editorial' CHECK(kind='editorial'),since_year INTEGER);
CREATE TABLE source(id TEXT PRIMARY KEY,publisher TEXT NOT NULL,table_name TEXT NOT NULL,url TEXT NOT NULL,retrieved_on TEXT NOT NULL,license TEXT NOT NULL,definition TEXT NOT NULL,kind TEXT NOT NULL);
CREATE TABLE series(profession_id TEXT NOT NULL REFERENCES profession, measure TEXT NOT NULL, "group" TEXT NOT NULL, year INTEGER NOT NULL,value REAL NOT NULL,unit TEXT NOT NULL,definition TEXT NOT NULL CHECK(length(trim(definition))>0),source_id TEXT NOT NULL REFERENCES source,series_id TEXT NOT NULL,PRIMARY KEY(profession_id,measure,"group",year,series_id));
""")
editorial_references = {}
for p in professions:
    db.execute('insert into profession values(?,?,?,?,?)',(p['id'],p['name'],p['slug'],p.get('soc_code'),json.dumps(p['aliases'])))
    for panel, field in [('origin','builder'),('gate','gatekeeper')]:
        a = p[panel]
        assert a[field] and set(a[field]) <= enums and a['status'] in ('draft','supported')
        assert len(a['citations']) >= 2 and len({c['url'] for c in a['citations']}) >= 2
        citation_ids = []
        for citation in a['citations']:
            address = citation['url']
            assert address.startswith('https://'), address
            key = 'editorial-' + sha256(address.encode()).hexdigest()[:16]
            editorial_references.setdefault(key, {
                'id': key, 'publisher': urlparse(address).hostname, 'table_name': citation['title'],
                'url': address, 'retrieved_on': '2026-11-03', 'license': 'Link to original publisher',
                'definition': 'Institutional reference for an editorial classification.', 'kind':'editorial'
            })
            citation_ids.append(key)
        years = (a.get('era_start'),a.get('era_end')) if panel=='origin' else (a.get('since_year'),)
        values = (p['id'],json.dumps(a[field]),a['era'],a['rationale'],json.dumps(citation_ids),a['status'],'editorial',*years)
        db.execute(f"insert into {panel} values ({','.join('?' for _ in values)})",values)
sources, points, notes = [], [], []
for path in sorted((DATA / 'imports').glob('*.json')):
    snapshot = load(path)
    sources.extend(snapshot['sources'])
    points.extend(snapshot['series'])
    notes.extend(snapshot.get('notes',[]))
histories = [load(path) for path in sorted((DATA / 'history').glob('*.json'))]
(DATA/'history-index.json').write_text(json.dumps(histories,ensure_ascii=False,separators=(',',':'))+'\n')
for history in histories:
    assert history['slug'] in {p['slug'] for p in professions}
    ids = set()
    for event in history['events']:
        assert event['id'] not in ids and event['change'] and event['limit']
        ids.add(event['id'])
        for i, reference in enumerate([event['source'], *event.get('sources', [])]):
            assert reference['url'].startswith('https://') and reference['locator']
            sources.append({
                'id': 'history-' + history['slug'] + '-' + event['id'] + '-' + str(i),
                'publisher': urlparse(reference['url']).hostname,
                'table_name': reference['title'], 'url': reference['url'],
                'retrieved_on': '2026-11-03', 'license': 'Link to original; publisher rights apply',
                'definition': 'Referenced for: ' + event['title'] + '. Read the episode for the specific claim.',
                'locator': reference['locator'], 'limits': event['limit'],
                'professions': [history['slug']], 'kind': 'history',
                'episode': '/p/' + history['slug'] + '/#history-' + event['id'],
                'source_type': reference['type']
            })
for s in [*sources,*editorial_references.values()]:
    assert s['url'].startswith('https://') and s['retrieved_on'] and s['definition'], s['id']
    db.execute('insert into source values(?,?,?,?,?,?,?,?)',tuple(s[k] for k in ('id','publisher','table_name','url','retrieved_on','license','definition'))+(s.get('kind','measurement'),))
for row in points:
    assert row['group'] in ('black_male','black_female','all_male','all_female'), row
    assert row['measure'] in ('share_of_profession','share_of_black','entrants','count'), row
    assert row['year'] >= 1990 and row['value'] >= 0 and row['series_id'], row
    if row['unit'] in ('percent','%','percentage'): assert row['value'] <= 100, row
    db.execute('insert into series values(?,?,?,?,?,?,?,?,?)',tuple(row[k] for k in ('profession_id','measure','group','year','value','unit','definition','source_id','series_id')))
assert not db.execute('pragma foreign_key_check').fetchall()
db.commit()
temp = dbfile.with_suffix('.tmp')
temp.unlink(missing_ok=True)
with sqlite3.connect(temp) as dest: db.backup(dest)
temp.replace(dbfile)
with (DATA / 'series.csv').open('w',newline='') as f:
    writer=csv.writer(f)
    cur=db.execute('select * from series order by profession_id,measure,"group",year,series_id')
    writer.writerow([c[0] for c in cur.description]); writer.writerows(cur)
bundle={'professions':professions,'sources':sources,'series':points,'roles':roles,'notes':notes}
(DATA / 'catalog.json').write_text(json.dumps(bundle,ensure_ascii=False,separators=(',',':'))+'\n')
print(f'{len(professions)} professions, {len(sources)} sources, {len(points)} observations validated.')
client_dir=ROOT/'public'/'data'
client_dir.mkdir(parents=True,exist_ok=True)
compact_prof=[{k:p[k] for k in ('name','slug')} for p in professions]
compact_src=[{k:s[k] for k in ('id','table_name')} for s in sources]
(client_dir/'compare.json').write_text(json.dumps({'professions':compact_prof,'sources':compact_src,'series':points},ensure_ascii=False,separators=(',',':')))
(client_dir/'observations.csv').write_bytes((DATA/'series.csv').read_bytes())
with (client_dir/'sources.csv').open('w',newline='') as f:
    writer=csv.writer(f,lineterminator='\n');cur=db.execute('select * from source order by publisher,table_name,id')
    writer.writerow([c[0] for c in cur.description]);writer.writerows(cur)

(client_dir/'histories.json').write_text(json.dumps(histories,ensure_ascii=False,indent=2)+'\n')
