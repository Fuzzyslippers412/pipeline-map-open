import {sourceDate} from './source-date.js';
import {employerKey as alias, normalizeEmployerText as normalize} from './employer-key.js';
import { ericSources } from './eric-sources.js';
import { newsSources } from './news-sources.js';
import { europePmcSources } from './europe-pmc-sources.js';
import { usaSpendingSources } from './usa-spending-sources.js';
import catalog from '../../data/discovery-index.json' with {type:'json'};

const NSF='U.S. National Science Foundation';
const ERIC='ERIC · U.S. Department of Education';
const USA='USAspending · federal awards';
const NEWS='GDELT · recent news';
const healthcare=['physician','dentist','pharmacist','registered-nurse'];
const fields = {
  physician:/\b(physicians?|medical students?|medical school|residenc(?:y|ies)|doctors?)\b/i,
  lawyer:/\b(lawyers?|attorneys?|law school|legal profession|law students?)\b/i,
  engineer:/\b(engineer(?:s|ing)?)\b/i,
  dentist:/\b(dental|dentists?|dentistry)\b/i,
  pharmacist:/\b(pharmacists?|pharmacy|pharmacies)\b/i,
  'registered-nurse':/\b(nurs(?:e|es|ing))\b/i,
  'k12-teacher':/\b(teachers?|teacher education|teacher preparation)\b/i,
  professor:/\b(faculty|professors?|professorships?)\b/i,
  journalist:/\b(journalis(?:m|ts?)|newsrooms?|reporters?)\b/i,
  'nonprofit-executive':/\b(nonprofit leadership|nonprofit executives?|nonprofit management)\b/i,
  'elected-official':/\b(elected officials?|elected office|legislators?)\b/i,
  pastor:/\b(pastors?|seminar(?:y|ies)|clergy)\b/i,
  'military-officer':/\b(military officers?|commissioned officers?|ROTC|officer training)\b/i,
  'police-officer':/\b(police officers?|police academ(?:y|ies)|law enforcement officers?)\b/i,
  electrician:/\b(electricians?|electrical trades?)\b/i,
  'software-engineer':/\b(software|computer science|programmers?|computer programming|coding)\b/i,
  'corporate-executive':/\b(corporate leadership|corporate executives?|executive management)\b/i,
  entrepreneur:/\b(entrepreneurs?|entrepreneurship|business owners?)\b/i,
  'pro-athlete':/\b(professional athletes?|professional sports|NFL|NBA)\b/i,
  musician:/\b(musicians?|music industry|performing arts|singers?)\b/i,
};

const blackPath=/\b(?:HBCUs?|historically[- ]Black|African[- ]American|Black (?:students?|graduates?|professionals?|engineers?|physicians?|schools?|colleges?|universit(?:y|ies)|workers?|communities|nurs(?:es|ing)))\b/i;
const opportunity=/\b(?:internships?|apprentice\w*|training|workforce|career\w*|fellowships?|mentorship|professional development|scholarships?|recruitment|hiring|teacher preparation|faculty development)\b/i;
const mentions=(body,name)=>(' '+normalize(body)+' ').includes(' '+normalize(name)+' ');
const plain=s=>String(s||'').replace(/<[^>]*>/g,' ').replace(/\s+/g,' ').trim();

function roleMatches(text,{profession,title}){
  const slug=typeof profession==='object'?profession?.slug:profession;
  if(Object.hasOwn(fields,slug))return fields[slug].test(text);
  const role=normalize(title).replace(/^(?:(?:senior|junior|lead|principal) )+/,'');
  return role.length>2 && [role,role+'s'].some(t=>mentions(text,t));
}
function grantDescription(record,documented){
  const kind=record.publisher===NSF?'National Science Foundation':'federal';
  const detail=documented?'Its published program description connects Black access or HBCUs with career development in this field.':'The award description concerns Black access or HBCUs and career development. Check the original for the connection to your role.';
  return record.issuer+' is the listed recipient of '+kind+' award '+record.awardId+'. '+detail;
}
// The publisher is the recipient's authoritative funding record. A grant match
// documents funding for the program, not a hiring outcome or a person's history.
function indexDate(record){
  if (record.publisher===NSF) return sourceDate(record.publishedOn,'award','NSF award date');
  if (record.publisher===USA) return sourceDate(record.publishedOn,'award','Award period start');
  if (record.publisher===ERIC) return sourceDate(record.publishedOn,'publication','Publication date');
  // A news index's first-seen date is distinct from the publication date.
  return {dateBasis:'unknown'};
}

export function matchIndex(index,input,providers){
  const name=alias(input.employer);
  if(!name)return [];
  const slug=typeof input.profession==='object'?input.profession?.slug:input.profession;
  return index.records.flatMap(record=>{
    if(!providers.has(record.publisher))return [];
    const recipient=record.issuer && alias(record.issuer)===name;
    const institution=(record.mentions||[]).some(entity=>alias(entity)===name);
    if(!recipient&&!institution&&!mentions(record.title,input.employer))return [];
    const documented=!!recipient && (record.fundedFields||[]).includes(slug);
    let excerpt;
    if(recipient)excerpt=grantDescription(record,documented);
    else if(record.publisher===NEWS)excerpt='The indexed headline contains the entered employer name and a career-access topic. Confirm the employer identity and the relationship to your field in the publisher’s report.';
    else excerpt='The education research record names the institution and discusses Black access or HBCUs and career development. Check the original for the connection to your specific role.';
    return [{title:record.title,url:record.url,publisher:record.outlet||record.publisher,excerpt,kind:documented?'documented':'lead',mode:'indexed',indexedOn:record.indexedOn||index.asOf,...indexDate(record),roleMatch:(record.fields||[]).includes(slug)}];
  }).sort((a,b)=>Number(b.kind==='documented')-Number(a.kind==='documented')||Number(b.roleMatch)-Number(a.roleMatch)||(b.publishedOn||'').localeCompare(a.publishedOn||'')||a.title.localeCompare(b.title));
}
async function nsf(input){
  const url=new URL('https://api.nsf.gov/services/v1/awards.json');
  url.search=new URLSearchParams({awardeeName:input.employer,keyword:'HBCU',printFields:'id,title,awardeeName,abstractText,date,initAmendmentDate'}).toString();
  const response=await input.fetchImpl(url.href,{signal:input.signal,credentials:'omit',referrerPolicy:'no-referrer',redirect:'manual',headers:{Accept:'application/json'}});
  if(!response.ok||!response.headers.get('content-type')?.includes('json'))throw Error('NSF unavailable');
  const json=await response.json();const records=json.response?.award;
  if(!Array.isArray(records)){
    if(json.response?.notification?.code==='AwardAPI-004')return [];
    throw Error('Unexpected NSF response');
  }
  return records.flatMap(a=>{
    if(!/^\d{5,10}$/.test(String(a.id))||alias(a.awardeeName)!==alias(input.employer))return [];
    const title=plain(a.title),body=plain(a.abstractText), context=title+' '+body;
    if(!blackPath.test(context)||!opportunity.test(context))return [];
    const fieldTitle=title.replace(/science[, ]+technology[, ]+(?:and )?engineering[, ]+(?:and |or )?mathematics/gi,'STEM');
    const documented=roleMatches(fieldTitle,input)&&body.split(/(?<=[.!?])\s+(?=[A-Z])/).some(line=>{
      const passage=title+'. '+line;
      return line.length<=1200&&blackPath.test(passage)&&opportunity.test(passage)&&roleMatches(passage,input);
    });
    return [{title,url:'https://www.nsf.gov/awardsearch/showAward?AWD_ID='+a.id,publisher:NSF,kind:documented?'documented':'lead',...sourceDate(a.date||a.initAmendmentDate,'award','NSF award date'),excerpt:grantDescription({issuer:plain(a.awardeeName),awardId:a.id,publisher:NSF},documented)}];
  });
}
async function collect(group,input){
  const outcomes=await Promise.allSettled(group.tasks.map(task=>task(input)));
  if(input.parentSignal?.aborted)throw input.parentSignal.reason;
  return {name:group.name,status:outcomes.every(x=>x.status==='fulfilled')?'ok':'unavailable',hadResponse:outcomes.some(x=>x.status==='fulfilled'),results:outcomes.flatMap(x=>x.status==='fulfilled'?x.value:[])};
}
export async function discoverSources({employer,title='',profession='',signal,fetchImpl=globalThis.fetch}){
  const name=String(employer||'').trim().replace(/\s+/g,' ').slice(0,160);
  const populated=Object.fromEntries(Object.entries(catalog.publishers).filter(([,count])=>count>0));
  const index={asOf:catalog.asOf,records:catalog.records.length,publishers:populated};
  if(normalize(name).length<2||/^(?:workplace|company|hospital|university|school|employer|self employed|n a|none)$/.test(normalize(name)))return {status:'complete',results:[],providers:[],counts:{live:0,indexed:0},index};
  if(signal?.aborted)throw signal.reason??new DOMException('Cancelled','AbortError');
  const timeout=new AbortController(),abort=()=>timeout.abort(signal?.reason);
  signal?.addEventListener('abort',abort,{once:true});
  const timer=setTimeout(()=>timeout.abort(new DOMException('Publisher timeout','TimeoutError')),10000);
  const input={employer:name,title:String(title||'').slice(0,120),profession,signal:timeout.signal,parentSignal:signal,fetchImpl};
  const slug=typeof profession==='object'?profession?.slug:profession;
  const groups=[{name:ERIC,tasks:[ericSources]},{name:USA,tasks:[ctx=>usaSpendingSources(ctx,'grants'),ctx=>usaSpendingSources(ctx,'contracts')]},{name:NEWS,tasks:[newsSources]},{name:NSF,tasks:[nsf]}];
  if(healthcare.includes(slug)||/\b(?:medical|physician|nurse|hospital|healthcare|clinical|pharmacist|dentist)\b/i.test(title))groups.push({name:'Europe PMC · health research',tasks:[europePmcSources]});
  try{
    const checked=await Promise.all(groups.map(group=>collect(group,input)));
    if(signal?.aborted)throw signal.reason??new DOMException('Cancelled','AbortError');
    const live=checked.flatMap(c=>c.results).map(r=>({dateBasis:'unknown',...r,mode:'live'}));
    const fallbackProviders=new Set(checked.filter(c=>c.status!=='ok'||!c.results.length).map(c=>c.name));
    const indexed=matchIndex(catalog,input,fallbackProviders);
    const sorted=[...live.filter(r=>r.kind==='documented'),...indexed.filter(r=>r.kind==='documented'),...live.filter(r=>r.kind==='lead'),...indexed.filter(r=>r.kind==='lead')];
    const seen=new Map();
    for(const item of sorted){
      const prior=seen.get(item.url);
      if(!prior || (item.mode==='live'&&prior.mode==='indexed'))seen.set(item.url,item);
    }
    // Keep room for leads just returned by a live publisher even when there
    // are many historically indexed awards at the same research institution.
    const all=[...seen.values()], shortlist=all.slice(0,10);
    for(const entry of all.filter(r=>r.mode==='live').slice(0,2)){
      if(!shortlist.includes(entry)){
        const slot=shortlist.findLastIndex(r=>r.mode==='indexed');
        if(slot>=0)shortlist[slot]=entry;
      }
    }
    const n=shortlist.filter(r=>r.mode==='live').length;
    return {status:checked.every(c=>c.status==='ok')?'complete':checked.some(c=>c.hadResponse)?'partial':'unavailable',
      results:shortlist,counts:{live:n,indexed:shortlist.length-n},index,providers:checked.map(c=>({name:c.name,status:c.status,
        ...(populated[c.name]?{indexedOn:catalog.records.find(r=>r.publisher===c.name)?.indexedOn||catalog.asOf,indexedDocuments:populated[c.name]}:{})}))};
  }finally{clearTimeout(timer);signal?.removeEventListener('abort',abort)}
}
