"""Build local employer suggestions from public institutional directories.

Cache input downloads outside the repository with --cache. Use --refresh to
fetch a new edition of mutable inputs. All directory files are written only
after every download and cross-file join passes validation.
"""
import argparse
import concurrent.futures
import csv
import datetime as dt
import io
import json
from pathlib import Path
import re
import tempfile
import urllib.parse
import urllib.request
import zipfile

ROOT = Path(__file__).resolve().parents[1]
USER_AGENT = 'PipelineMap/1.0 (+https://pipeline-map.fuzzyslipper.chatgpt.site/method/)'
EDGE = 'https://nces.ed.gov/programs/edge/data/'
HRSA = 'https://gisportal.hrsa.gov/server/rest/services/HealthCareFacilities/'
CLINICS = HRSA+'PrimaryHealthCareFacilities_FS/MapServer/0'
HOSPITALS = HRSA+'CMSApprovedFacilities_FS/MapServer/'
IPED = 'https://nces.ed.gov/ipeds/datacenter/data/HD2024.zip'
SEC = 'https://www.sec.gov/files/company_tickers_exchange.json'

MAIN_SOURCES = {
    'ipeds': {'title':'NCES IPEDS Institutional Characteristics, directory information', 'url':'https://nces.ed.gov/ipeds/datacenter/DataFiles.aspx?year=2024','download':IPED,'edition':'2024 survey'},
    'sec': {'title':'SEC EDGAR company ticker and exchange associations', 'url':'https://www.sec.gov/search-filings/edgar-search-assistance/accessing-edgar-data','download':SEC,'edition':'Snapshot of SEC registrant names and exchange associations'},
    'clinic': {'title':'HRSA Health Care Service Delivery Sites', 'url':CLINICS,'edition':'Active service sites as listed by HRSA'},
    'hospital': {'title':'HRSA CMS Approved Facilities, hospitals', 'url':HOSPITALS+'0','edition':'Hospitals as listed by HRSA'},
    'cah': {'title':'HRSA CMS Approved Facilities, critical access hospitals', 'url':HOSPITALS+'1','edition':'Critical access hospitals as listed by HRSA'},
}
SCHOOL_SOURCES = {
    'school': {'title':'NCES EDGE public school locations','url':'https://catalog.data.gov/dataset/public-school-locations-2024-25','download':EDGE+'EDGE_GEOCODE_PUBLICSCH_2425.zip','edition':'2024–25','relatedSources':['district']},
    'district': {'title':'NCES EDGE public school agency locations','url':'https://nces.ed.gov/programs/edge/Geographic/SchoolLocations','download':EDGE+'EDGE_GEOCODE_PUBLICLEA_2425.zip','edition':'2024–25'},
}

def download(url):
    with urllib.request.urlopen(urllib.request.Request(url,headers={'User-Agent':USER_AGENT}),timeout=75) as response:
        return response.read()

def cached(cache, name, make, refresh):
    path = cache / name
    if path.exists() and not refresh:
        return path.read_bytes()
    result = make()
    tmp = path.with_suffix(path.suffix+'.tmp')
    tmp.write_bytes(result)
    tmp.replace(path)
    return result

def arc_rows(layer, fields, where):
    def query(params):
        url = layer+'/query?'+urllib.parse.urlencode({'f':'json',**params})
        result = json.loads(download(url))
        if 'error' in result:
            raise ValueError('HRSA query failed: '+str(result['error']))
        return result
    ids = sorted(query({'where':where,'returnIdsOnly':'true'})['objectIds'])
    if not ids or len(ids) != len(set(ids)): raise ValueError('Invalid HRSA facility identifiers')
    rows=[]
    for start in range(0,len(ids),400):
        selected=ids[start:start+400]
        page=query({'objectIds':','.join(map(str,selected)),'outFields':','.join(['OBJECTID',*fields]),'returnGeometry':'false'})
        group=[x['attributes'] for x in page['features']]
        if set(selected)!={r['OBJECTID'] for r in group}:
            raise ValueError('Incomplete HRSA facility page')
        rows.extend(group)
    return json.dumps(rows,separators=(',',':'),ensure_ascii=False).encode()

def clean(s):
    return ' '.join(str(s or '').split()).strip()
def display(s):
    s=clean(s)
    if not s.isupper(): return s
    words=s.title()
    for abbr in ('VA','US','USA','DC','LLC','LP','LLP','IBM','NVIDIA','AMD','HP','HUD','UCLA','USC','SUNY','CUNY','NYC','ESL','STEM','STEAM','KIPP','YMCA','HIV','AIDS','PLC','ETF','BMO','HSBC'):
        words=re.sub(r'\b'+abbr+r'\b',abbr,words,flags=re.I)
    return words
def place(city,state):
    return ', '.join(v for v in (display(city),clean(state).upper()) if v)
def rec(uid,name,source,kind,location='',parent='',relation='',aliases=()):
    row={'id':uid,'name':display(name),'kind':kind,'source':source}
    if location:row['location']=location
    if clean(parent) and clean(parent).casefold()!=row['name'].casefold():
        row.update(parent=display(parent),relation=relation)
    alternatives=list(dict.fromkeys(v for v in map(clean,aliases) if v and v.casefold()!=row['name'].casefold()))
    if alternatives:row['aliases']=alternatives
    return row

def sec_rows(data):
    feed=json.loads(data)
    if feed['fields']!=['cik','name','ticker','exchange']:raise ValueError('SEC field definition changed')
    registrants={}
    for cik,name,ticker,exchange in feed['data']:
        if not exchange:continue
        record=registrants.setdefault(cik,{'name':name,'tickers':[]})
        if record['name']!=name: raise ValueError('Conflicting names for SEC CIK '+str(cik))
        record['tickers'].append(ticker)
    return [rec('sec-'+str(cik),r['name'],'sec','SEC registrant',aliases=r['tickers']) for cik,r in registrants.items()]

def zipped_table(data, suffix, delimiter, header=False):
    archive=zipfile.ZipFile(io.BytesIO(data))
    names=[n for n in archive.namelist() if n.lower().endswith(suffix)]
    if len(names)!=1:raise ValueError('Unexpected national archive format')
    with archive.open(names[0]) as stream:
        source=io.TextIOWrapper(stream,encoding='utf-8-sig',newline='')
        return list((csv.DictReader if header else csv.reader)(source,delimiter=delimiter))

def colleges(data):
    result=[]
    for r in zipped_table(data,'.csv',',',True):
        if r['CYACTIVE']!='1':continue
        parent = clean(r['F1SYSNAM']) if r['F1SYSTYP']=='1' and r['F1SYSCOD'].strip() not in ('','-1','-2','-3') else ''
        aliases=[s for s in re.split(r'\s{2,}|[|;/]',r['IALIAS'].strip()) if clean(s) and len(clean(s)) <= 160 and clean(s) not in ('-1','-2','-3')]
        result.append(rec('ipeds-'+r['UNITID'],r['INSTNM'],'ipeds','College or university',place(r['CITY'],r['STABBR']),parent,'Education system / organization',aliases))
    return result

def schools(sch_data, agency_data):
    agencies=zipped_table(agency_data,'.txt','|')
    district={r[0]:r for r in agencies}
    if len(district)!=len(agencies): raise ValueError('Duplicate NCES agency ID')
    result=[]
    for r in district.values():
        result.append(rec('nces-agency-'+r[0],r[1],'district','Education agency',place(r[4],r[5])))
    for r in zipped_table(sch_data,'.txt','|'):
        # LEA may be a charter agency, state agency or supervisory union rather
        # than a conventional district. Never infer legal ownership from its name.
        agency=district.get(r[1])
        if not agency:raise ValueError('School with unrecognized NCES agency ID: '+r[0])
        result.append(rec('nces-school-'+r[0],r[2],'school','Public school',place(r[5],r[6]),agency[1],'School district / agency'))
    return result

def health(data,source):
    rows=[]
    for r in json.loads(data):
        if source=='clinic':
            rows.append(rec('hrsa-site-'+str(r['SITE_SOURCE_ID']),r['SITE_NM'],source,'Health center site',place(r['SITE_CITY'],r['SITE_STATE_ABBR']),r['GRANTEE_NM'],'Health center grantee'))
        else:
            rows.append(rec('cms-'+source+'-'+str(r['CMS_PROVIDER_NUM']),r['FACILITY_NM'],source,'Hospital',place(r['CMS_PROVIDER_CITY'],r['CMS_PROVIDER_STATE_ABBR'])))
    return rows

# Published campus/health-system examples supplement the source registers. A
# campus is labelled with its organization; clinical affiliations are not owners.
EXAMPLES=[
    ('huh','Howard University Hospital','Howard University','Parent organization','Washington, DC','Hospital',['HUH','Howard University Hospital Corp'], 'Howard University · audited hospital financial statements','https://howard.edu/sites/home.howard.edu/files/2025-06/Howard%20University%20Hospital%20FS%20Dec%2031%202024.pdf'),
    ('va-dc','Washington VA Medical Center','VA Washington DC health care','VA health care system','Washington, DC','VA medical center',['Washington DC VA Medical Center','Washington DC VAMC'],'Department of Veterans Affairs · Washington VA Medical Center','https://www.va.gov/washington-dc-health-care/locations/washington-va-medical-center/'),
    ('va-atl','Joseph Maxwell Cleland Atlanta VA Medical Center','VA Atlanta health care','VA health care system','Decatur, GA','VA medical center',['Atlanta VA Medical Center','Atlanta VAMC'],'Department of Veterans Affairs · VA Atlanta health care','https://www.va.gov/atlanta-health-care/about-us/'),
    ('grady','Grady Memorial Hospital','Grady Health System','Health system','Atlanta, GA','Hospital',['Grady Hospital'],'Grady Health · Grady Memorial Hospital','https://www.gradyhealth.org/locations/grady-memorial-hospital/'),
    ('emory','Emory University Hospital Midtown','Emory Healthcare','Health system','Atlanta, GA','Hospital',['Emory Midtown'],'Emory Healthcare · Emory University Hospital Midtown','https://www.emoryhealthcare.org/locations/hospitals/emory-university-hospital-midtown'),
    ('apple-park','Apple Park','Apple','Company campus','Cupertino, CA','Company campus',[],'Apple · Apple Park opens to employees','https://www.apple.com/newsroom/2017/02/apple-park-opens-to-employees-in-april/'),
    ('amazon-hq2','Metropolitan Park','Amazon','Company campus','Arlington, VA','Company campus',['Amazon HQ2','Amazon Metropolitan Park'],'Amazon · HQ2 offices in Arlington','https://www.aboutamazon.com/news/amazon-offices/amazon-opens-offices-at-hq2-in-arlington-va'),
    ('walmart','Walmart Home Office','Walmart','Company campus','Bentonville, AR','Company campus',['Walmart headquarters'],'Walmart · New Home Office','https://corporate.walmart.com/news/2025/01/17/the-future-of-better-begins-here-welcome-to-walmarts-new-home-office'),
    ('microsoft','Microsoft Redmond campus','Microsoft','Company campus','Redmond, WA','Company campus',['Microsoft headquarters'],'Microsoft · Redmond campus fact sheet','https://news.microsoft.com/uploads/prod/sites/370/2018/11/Microsoft-Redmond-Campus-Fact-Sheet-.pdf'),
    ('bay-view','Google Bay View campus','Google','Company campus','Mountain View, CA','Company campus',['Bay View'],'Google · Bay View campus','https://blog.google/company-news/inside-google/life-at-google/bay-view-campus-grand-opening/'),
    ('google','Google','Alphabet','Parent organization','','Company',['Google LLC'],'Alphabet · annual report','https://www.sec.gov/Archives/edgar/data/1652044/000165204426000018/goog-20251231.htm'),
]

def directory(rows,sources,as_of):
    ordered=sorted(rows,key=lambda row:(row['name'].casefold(),row.get('location','').casefold(),row.get('parent','').casefold(),row['id']))
    if len({r['id'] for r in ordered})!=len(ordered):raise ValueError('Repeated source ID')
    if any(not r['name'] or r['source'] not in sources or (bool(r.get('parent'))!=bool(r.get('relation'))) for r in ordered):
        raise ValueError('Incomplete registry row')
    return {'asOf':as_of,'sources':sources,'records':ordered}

def gather(args):
    cache=args.cache;cache.mkdir(parents=True,exist_ok=True)
    tasks={'ipeds.zip':lambda:download(IPED),'sec.json':lambda:download(SEC),
        'edges2425.zip':lambda:download(SCHOOL_SOURCES['school']['download']),
        'lea2425.zip':lambda:download(SCHOOL_SOURCES['district']['download']),
        'clinic.json':lambda:arc_rows(CLINICS,['SITE_SOURCE_ID','SITE_NM','SITE_CITY','SITE_STATE_ABBR','GRANTEE_NM'],"HCC_STATUS_DESC='Active'")}
    for label,n in [('hospital','0'),('cah','1')]:
        tasks[label+'.json']=lambda n=n:arc_rows(HOSPITALS+n,['CMS_PROVIDER_NUM','FACILITY_NM','CMS_PROVIDER_CITY','CMS_PROVIDER_STATE_ABBR'],'1=1')
    source_data={}
    with concurrent.futures.ThreadPoolExecutor(max_workers=3) as executor:
        pending={executor.submit(cached,cache,name,get,args.refresh):name for name,get in tasks.items()}
        for future in concurrent.futures.as_completed(pending):source_data[pending[future]]=future.result()
    main=colleges(source_data['ipeds.zip'])+sec_rows(source_data['sec.json'])
    main.extend(health(source_data['clinic.json'],'clinic'))
    # HRSA's hospital and critical-access subsets overlap. Use CMS's facility
    # number to avoid turning the same Medicare provider into two workplaces.
    seen_cms=set()
    for label in ('cah','hospital'):
        for record in health(source_data[label+'.json'],label):
            ccn=record['id'].rsplit('-',1)[-1]
            if ccn=='090003':continue  # Howard hospital is in the cited examples below.
            if ccn in seen_cms:continue
            seen_cms.add(ccn);main.append(record)
    sources=dict(MAIN_SOURCES)
    for key,name,parent,relation,location,kind,aliases,source_title,url in EXAMPLES:
        key='verified-'+key
        sources[key]={'title':source_title,'url':url,'edition':'Publisher-verified workplace description'}
        # Keep the better-supported record for the same facility and city.
        same=lambda r:r['name'].casefold()==name.casefold() and r.get('location','').casefold()==location.casefold()
        main=[r for r in main if not same(r)]
        main.append(rec(key,name,key,kind,location,parent,relation,aliases))
    schs=schools(source_data['edges2425.zip'],source_data['lea2425.zip'])
    if len(main)<20000 or len(schs)<100000:raise ValueError('Unexpectedly small source edition')
    # A reused cache retains its actual retrieval dates.
    latest=lambda names:max(dt.date.fromtimestamp((cache / name).stat().st_mtime).isoformat() for name in names)
    registry=directory(main,sources,latest(['sec.json','ipeds.zip','clinic.json','hospital.json','cah.json']))
    schooldir=directory(schs,SCHOOL_SOURCES,latest(['edges2425.zip','lea2425.zip']))
    return {'workplace-directory.json':registry,'workplace-schools.json':schooldir}

if __name__=='__main__':
    parser=argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--cache',type=Path,required=True)
    parser.add_argument('--refresh',action='store_true',help='Retrieve fresh source files rather than reusing the local cache')
    parser.add_argument('--output-dir',type=Path,default=ROOT/'data')
    args=parser.parse_args();outputs=gather(args)
    args.output_dir.mkdir(parents=True,exist_ok=True)
    staged=[]
    for name,obj in outputs.items():
        with tempfile.NamedTemporaryFile(mode='w',encoding='utf-8',dir=args.output_dir,delete=False,suffix='.json.tmp') as f:
            json.dump(obj,f,ensure_ascii=False,separators=(',',':'));f.write('\n')
            staged.append((Path(f.name),args.output_dir / name))
        print(name,len(obj['records']),'records')
    for temp,dest in staged:temp.replace(dest);dest.chmod(0o644)
