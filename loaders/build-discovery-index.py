"""Build a dated bibliographic index from public, employer-independent program searches.

Consults NSF Awards, USAspending, ERIC, and GDELT's documented APIs. Only original
metadata, field flags and award-recipient identities survive. No article/abstract
text, author fields, individuals' profiles, images or filings are redistributed.
"""
import argparse
import concurrent.futures
import datetime as dt
import html
import json
from pathlib import Path
import re
import time
import urllib.parse as parse
import urllib.request as request
from urllib.error import HTTPError

ROOT = Path(__file__).resolve().parents[1]
OUT = ROOT / 'data' / 'discovery-index.json'
NSF = 'U.S. National Science Foundation'
USA = 'USAspending · federal awards'
ERIC = 'ERIC · U.S. Department of Education'
NEWS = 'GDELT · recent news'
BLACK = re.compile(r'\b(?:HBCUs?|historically[- ]Black|African[- ]American|Black (?:college|university|universities|community|communities|graduate|teacher|student|worker|faculty|professional|women|men|scientist|engineer|nurs|education))', re.I)
PATH = re.compile(r'\b(?:internship|apprentice|workforce|career|training|scholarship|mentor|fellowship|teacher preparation|faculty development|recruit|professional development|job placement|employment|pipeline)', re.I)
PROFILES = re.compile(r"\b(?:obituary|biograph\w*|spotlight|in memoriam|meet the|alumnus|alumna|his story|her story|scholar who|student who|person of the year|memoriam|personal narrative|autoethnograph\w*|my journey|her journey|his journey)\b", re.I)
ROLES = {
 'physician':r'physician|medical school|medical student|medical residenc|doctoral training in medicine',
 'lawyer':r'lawyer|attorney|law school|legal profession', 'engineer':r'engineering|engineers?',
 'dentist':r'dental|dentist', 'pharmacist':r'pharmacist|pharmacy', 'registered-nurse':r'nurs(?:e|es|ing)',
 'k12-teacher':r'teacher|K[–-]12 teaching','professor':r'faculty|professors?',
 'journalist':r'journalism|journalist|newsroom','nonprofit-executive':r'nonprofit leadership|nonprofit management',
 'elected-official':r'elected office|legislator', 'pastor':r'seminary|clergy|pastor',
 'military-officer':r'ROTC|commissioned officers?', 'police-officer':r'police officer|police academy',
 'electrician':r'electrician|electrical trade','software-engineer':r'computer science|software|computer programming|coding',
 'corporate-executive':r'corporate executive|corporate leadership','entrepreneur':r'entrepreneur|business owner',
 'pro-athlete':r'professional athlete|professional sports','musician':r'musician|music industry',
}
REGEX = {slug:re.compile(r'\b(?:'+pattern+r')',re.I) for slug,pattern in ROLES.items()}
AFFILIATION = re.compile(r'\b(?:[A-Z][\w&’\x27.-]* +){1,5}(?:University|College|Public Schools|School District|Hospital|Health System|Medical Center)\b|\b(?:University|College) of (?:[A-Z][\w&’\x27.-]*|the)(?: (?:[A-Z][\w&’\x27.-]*|at|and|of)){0,4}')
QUERIES = {
 NSF: ['HBCU','historically black colleges'],
 USA: ['HBCU','historically black colleges','African American workforce'],
 ERIC: ['"historically black" AND (training OR career OR internship)', '"African American" AND (workforce OR professional OR apprenticeship)'],
 NEWS: ['(HBCU OR "historically black") (internship OR scholarship OR apprenticeship OR workforce)', '(HBCU OR "Black professionals") (partnership OR fellowship OR training)']
}

def get(url, query=None, body=None):
    if query: url+='?'+parse.urlencode(query)
    headers={'User-Agent':'PipelineMap metadata research (https://github.com/Fuzzyslippers412/pipeline-map)','Accept':'application/json'}
    data=None
    if body is not None:
        headers['Content-Type']='application/json';data=json.dumps(body).encode()
    for attempt in range(2):
        try:
            with request.urlopen(request.Request(url,data=data,headers=headers),timeout=24) as response:
                raw=response.read(8_000_001)
                if len(raw)>8_000_000: raise ValueError('Publisher response exceeds bound')
                return json.loads(raw)
        except HTTPError as exc:
            delay=exc.headers.get('Retry-After','10')
            if attempt or exc.code!=429 or not delay.isdigit() or int(delay)>20:raise
            time.sleep(max(7,int(delay)))

def clean(s):return ' '.join(html.unescape(re.sub('<[^>]*>',' ',str(s or ''))).split())
def norm(s):return re.sub(r'[^a-z0-9]+',' ',s.lower()).strip()
def subjects(text):
    # Expanding the STEM acronym does not document an engineering or math job.
    text=re.sub(r'science[, ]+technology[, ]+(?:and )?engineering[, ]+(?:and |or )?mathematics', 'STEM',text,flags=re.I)
    return sorted(slug for slug,expr in REGEX.items() if expr.search(text))
def mentions(text):
    result=set()
    for match in AFFILIATION.finditer(text):
        name=match.group().strip(' .,')
        name=re.sub(r'^(?:(?:At|The|From|This|For|An|When) )+','',name)
        if len(name)>5 and name not in ('Public Schools','School District','Health System','Medical Center'):
            result.add(name)
    return sorted(result)[:24]

def record(source,url,title,text,date,issuer='',award_id=''):
    title,text=clean(title),clean(text)
    if not title or PROFILES.search(title) or not BLACK.search(title+' '+text) or not PATH.search(title+' '+text):return None
    fields=subjects(title+' '+text)
    confirmed=[]
    if issuer:
        # Only a named award recipient can have a documented funding relationship.
        # A field in the award title or same sentence must coincide with BOTH
        # Black access and a career/training mechanism. This does not verify hiring.
        for sentence in re.split(r'(?<=[.!?])\s+(?=[A-Z])|\n',text):
            if len(sentence)>1200: continue
            context=title+'. '+sentence
            if BLACK.search(context) and PATH.search(context):
                # NSF program boilerplate can enumerate every STEM discipline.
                # Require the actual project title to specify the matched field;
                # otherwise the federal record is still a lead.
                confirmed.extend(set(subjects(context)) & set(subjects(title)))
    names=mentions(text) if not issuer else []
    return {'publisher':source,'url':url,'title':title[:280],'publishedOn':str(date or '')[:10],
      'issuer':clean(issuer),'awardId':award_id,'mentions':names,'fields':fields,'fundedFields':sorted(set(confirmed))}

def collect_nsf():
    records=[]
    for keyword in QUERIES[NSF]:
        for offset in [1,101,201,301]:
            body=get('https://api.nsf.gov/services/v1/awards.json',{'keyword':keyword,'offset':offset,'rpp':100,'printFields':'id,title,abstractText,awardeeName,date'})
            rows=body['response'].get('award',[])
            for row in rows:
                aid=str(row.get('id',''))
                if not re.fullmatch(r'\d{5,10}',aid):continue
                date=row.get('date','')
                try:date=dt.datetime.strptime(date,'%m/%d/%Y').date().isoformat()
                except ValueError:date=''
                records.append(record(NSF,'https://www.nsf.gov/awardsearch/showAward?AWD_ID='+aid,row.get('title'),row.get('abstractText'),date,row.get('awardeeName'),aid))
            if len(rows)<100:break
            time.sleep(.16)
    return records

def collect_usa():
    records=[]
    for keyword in QUERIES[USA]:
        for types in [['02','03','04','05'],['A','B','C','D']]:
            for page in [1,2,3]:
                body=get('https://api.usaspending.gov/api/v2/search/spending_by_award/',body={'filters':{'keywords':[keyword],'award_type_codes':types},
                   'fields':['Award ID','Recipient Name','Description','Start Date','Award Amount'],'sort':'Award Amount','order':'desc','limit':100,'page':page})
                rows=body['results']
                for row in rows:
                    key=str(row.get('generated_internal_id',''))
                    if not re.fullmatch(r'[A-Za-z0-9_.-]+',key):continue
                    aid=str(row.get('Award ID',''))
                    records.append(record(USA,'https://www.usaspending.gov/award/'+key,'Federal award '+aid,row.get('Description'),row.get('Start Date'),row.get('Recipient Name'),aid))
                if not body.get('page_metadata',{}).get('hasNext',len(rows)==100):break
                time.sleep(.16)
    return records

def collect_eric():
    records=[]
    for search in QUERIES[ERIC]:
        for start in [0,200,400]:
            body=get('https://api.ies.ed.gov/eric/',{'search':search,'format':'json','rows':200,'start':start,'fields':'id,title,description,publicationdateyear'})
            rows=body['response']['docs']
            for row in rows:
                aid=str(row.get('id',''))
                if not re.fullmatch(r'(?:ED|EJ)\d+',aid):continue
                records.append(record(ERIC,'https://eric.ed.gov/?id='+aid,row.get('title'),row.get('description'),row.get('publicationdateyear')))
            if len(rows)<200:break
            time.sleep(.16)
    return records

def collect_news():
    records=[]
    for query in QUERIES[NEWS]:
        body=get('https://api.gdeltproject.org/api/v2/doc/doc',{'query':query+' sourcelang:english','mode':'artlist','format':'json','maxrecords':100,'timespan':'3m'})
        for row in body.get('articles',[]):
            url=str(row.get('url',''));parts=parse.urlsplit(url)
            if parts.scheme!='https' or not parts.hostname or parts.username or parts.password:continue
            date=str(row.get('seendate',''))[:8]
            try:date=dt.datetime.strptime(date,'%Y%m%d').date().isoformat()
            except ValueError:date=''
            item=record(NEWS,url,row.get('title'),'',date)
            if item:item['outlet']=parts.hostname
            records.append(item)
        time.sleep(8)
    return records

def main():
    args=argparse.ArgumentParser(description=__doc__);args.add_argument('--output',type=Path,default=OUT);opt=args.parse_args()
    done={}; today=dt.datetime.now(dt.timezone.utc).date().isoformat()
    previous=json.loads(opt.output.read_text()) if opt.output.exists() else {'records':[]}
    failed=[]
    with concurrent.futures.ThreadPoolExecutor(max_workers=4) as pool:
        jobs={source:pool.submit(func) for source,func in [(NSF,collect_nsf),(USA,collect_usa),(ERIC,collect_eric),(NEWS,collect_news)]}
        for source,job in jobs.items():
            try:
                rows=job.result()
                done[source]={r['url']:{**r,'indexedOn':today} for r in rows if r}
            except Exception as exc:
                failed.append(source)
                done[source]={r['url']:r for r in previous['records'] if r['publisher']==source}
                print(source,'refresh failed, prior rows retained with their original dates:',type(exc).__name__,flush=True)
            print(source,len(done[source]),flush=True)
    records=sorted([r for table in done.values() for r in table.values()],key=lambda x:(x['publisher'],x['url']))
    data={'asOf':today,'refreshFailures':failed,'queries':QUERIES,
          'publishers':{s:len(table) for s,table in done.items()},'records':records}
    if not records or len(failed)==len(done):raise SystemExit('No fresh research records returned')
    # A failed publisher must not replace a previous complete edition.
    temp=opt.output.with_suffix('.tmp');temp.write_text(json.dumps(data,ensure_ascii=False,separators=(',',':'))+'\n');temp.replace(opt.output)
if __name__=='__main__': main()
