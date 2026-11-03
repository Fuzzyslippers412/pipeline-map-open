import { ericSources } from './eric-sources.js';

// Public publisher APIs are fixed here. A reader's input never chooses a host.
const publishers = {
  tmcf: {name:'Thurgood Marshall College Fund',host:'tmcf.org',collections:['posts','pages']},
  uncf: {name:'UNCF',host:'uncf.org',collections:['posts']},
  engineers: {name:'National Society of Black Engineers',host:'nsbe.org',collections:['article','program']},
  medical: {name:'National Medical Association',host:'nmanet.org',collections:['posts','pages']},
};
const engineering = ['engineer','software-engineer'];
const healthcare = ['physician','dentist','pharmacist','registered-nurse'];
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
const blackPath = /\b(HBCUs?|historically Black|African[- ]American|Black (?:students?|graduates?|professionals?|engineers?|physicians?|schools?|colleges?|universit(?:y|ies)|workers?|communities|nurs(?:es|ing))|Thurgood Marshall College Fund|United Negro College Fund|National Society of Black Engineers)\b/i;
const opportunity = /\b(internships?|interns?|scholarships?|apprentice\w*|residen(?:cy|cies)|training|fellowships?|career development|mentorship|recruitment|hiring|hired|pipeline|placement|career opportunities|education program|professional development|research grants?|grants? to support)\b/i;
const actor = /^(?:(?:plc|llc|inc|company|corporation|also|recently|jointly|will|has|have|announced|new|is|the|and|tmcf|uncf) ){0,4}(?:partner(?:ed|s|ship)?|sponsor(?:ed|s)?|fund(?:ed|s)?|launch(?:ed|es)?|offer(?:ed|s)?|support(?:ed|s)?|establish(?:ed|es)?|collaborat(?:e|ed|es)|hired|host(?:ed|s)?|provid(?:e|ed|es)|award(?:ed|s)?|creat(?:e|ed|es)|scholarships?|internships?|fellowships?|apprenticeships?|hbcu scholars?)\b/;
const partner = /(?:in partnership with|partnership between|partner(?:ed|s)? with|collaborat(?:ed|es|e) with|fund(?:ed|ing) (?:by|from)|support (?:of|from)|support(?:ed)? by|sponsored by|internships? (?:at|with)|mentors? (?:at|from)|hired by|grants? from|presented by|training (?:at|through))$/;
const negative = /\b(no longer|never|not|denied|unrelated|unaffiliated|propos(?:ed|al)|could|considering|seeking sponsors?|seeking partners?)\b/i;
const profile = /\b(obituar\w*|biograph\w*|spotlight|meet the|alumnus|alumna|student story|honoree|finds confidence|in memoriam|appoints?|life story|comments on|response on|reverend|student [‘’“”]|scholar (?:who|aspires|discovered|earns)|graduates? reflect|student (?:learns|discovered|shares|reflects|wins|aspires|finds)|journey of|super excited)\b/i;
const entities = {amp:'&',lt:'<',gt:'>',quot:'"',apos:"'",nbsp:' ',rsquo:'’',lsquo:'‘',rdquo:'”',ldquo:'“',ndash:'–',mdash:'—',hellip:'…'};

function decode(raw) {
  return String(raw || '').replace(/&(#x[0-9a-f]+|#\d+|\w+);/gi, (original, code)=>{
    if (code[0] !== '#') return entities[code] ?? original;
    const number = code[1]?.toLowerCase()==='x' ? parseInt(code.slice(2),16) : Number(code.slice(1));
    return number > 0 && number <= 0x10ffff ? String.fromCodePoint(number) : ' ';
  });
}
const plain = value => decode(String(value || '').replace(/<[^>]*>/g,' ')).replace(/\s+/g,' ').trim();
function paragraphs(html) {
  return String(html || '').slice(0,180000).replace(/<(script|style|nav|footer)\b[^>]*>[\s\S]*?<\/\1>/gi,' ')
    .split(/<\/(?:p|li|h[1-6]|tr|section|div)>|<br\s*\/?>/i).map(plain).filter(p=>p.length>12 && p.length<2400);
}
const normalized = value => String(value||'').normalize('NFKD').replace(/\p{M}/gu,'').toLowerCase()
  .replace(/&/g,' and ').replace(/[’']/g,'').replace(/[^\p{L}\p{N}]+/gu,' ').trim();
const contains = (text,phrase) => (' '+normalized(text)+' ').includes(' '+normalized(phrase)+' ');
function localRole(input) {
  const slug=typeof input.profession==='object' ? input.profession?.slug : input.profession;
  if(Object.hasOwn(fields,slug)) return text=>fields[slug].test(text);
  const title=normalized(input.title).replace(/^(?:(?:senior|junior|lead|principal) )+/,'');
  const variants=[title,title+'s'];
  if (/[^aeiou]y$/.test(title)) variants.push(title.slice(0,-1)+'ies');
  return text=>title.length>2 && variants.some(variant=>contains(text,variant));
}
function shortPassage(text,employer) {
  const words=text.split(/\s+/);
  if(words.length<=23) return text;
  const first=normalized(employer).split(' ')[0];
  const index=words.findIndex(word=>normalized(word)===first);
  const start=Math.max(0,Math.min(index-4,words.length-23));
  return (start?'… ':'')+words.slice(start,start+23).join(' ')+(start+23<words.length?' …':'');
}
function isProfilePassage(p) {
  return /[“”]|\b(?:she|he|her|his|said|my|I was|I am)\b/i.test(p);
}
function classify(article,input) {
  const {employer}=input, role=localRole(input);
  const title=plain(article.title);
  if(!title||profile.test(title)||!article.body.length) return null;
  const headerMatch=contains(title,employer);
  const nearby=article.body.filter(p=>contains(p,employer) && !isProfilePassage(p));
  if(!nearby.length && !headerMatch) return null;
  // Use one short passage or its own headline, never distant parts of a roundup.
  const relevant=nearby.find(p=>blackPath.test(title+' '+p) && opportunity.test(title+' '+p));
  const titleProgram=headerMatch && blackPath.test(title) && opportunity.test(title);
  const candidateParagraphs=titleProgram?article.body.slice(0,4):nearby;
  const candidatePassages=candidateParagraphs.flatMap(p=>p.split(/(?<=[.!?])\s+(?=[A-Z“])/));
  const confirmed=candidatePassages.find(p=>{
    if(p.length>1100||isProfilePassage(p)||negative.test(p+' '+title))return false;
    const context=title+'. '+p;
    if(!role(context)||!blackPath.test(context)||!opportunity.test(context))return false;
    // Both the named employer and a participation verb must occur together in the source.
    // A program named for the employer can also be explicit in the headline.
    return (titleProgram && (contains(p,employer)||/\b(this|the|our) (program|scholarship|internship|fellowship|opportunity)\b/i.test(p))) || (contains(p,employer) && namesAction(p,employer)) ||
      (headerMatch && namesAction(title,employer) && contains(p,employer));
  });
  if(confirmed)return {...article.result,title,excerpt:shortPassage(confirmed,employer),kind:'documented'};
  if(!relevant && !titleProgram)return null;
  return {...article.result,title,excerpt:'This publisher discusses the employer and an access program. Its connection to the entered job needs review.',kind:'lead'};
}
function namesAction(line,employer){
  const text=normalized(line), term=normalized(employer), index=(' '+text+' ').indexOf(' '+term+' ');
  if(index<0)return false;
  const before=text.slice(Math.max(0,index-85),index).trim();
  const after=text.slice(index+term.length).trim();
  return actor.test(after) || partner.test(before);
}
function officialUrl(value,host) {
  try{
    const url=new URL(value);
    return url.protocol==='https:' && !url.username && !url.password && !url.port &&
      [host,'www.'+host].includes(url.hostname) ? url.href : '';
  }catch{return ''}
}
async function fetchJson(url,context) {
  const response=await context.fetchImpl(url.href,{signal:context.signal,credentials:'omit',referrerPolicy:'no-referrer',redirect:'error',headers:{Accept:'application/json'}});
  if(!response.ok)throw Error('Publisher request failed');
  if(!response.headers.get('content-type')?.includes('json'))throw Error('Publisher did not return JSON');
  // Large WordPress pages can embed unrelated media; keep each fetch bounded.
  const limit=1_500_000;
  if(Number(response.headers.get('content-length'))>limit)throw Error('Publisher response too large');
  const reader=response.body?.getReader();
  if(!reader)throw Error('Publisher returned an empty body');
  const decoder=new TextDecoder();
  let size=0, text='';
  try{
    while(true){
      const {value,done}=await reader.read();
      if(done)break;
      size+=value.byteLength;
      if(size>limit){await reader.cancel();throw Error('Publisher response too large');}
      text+=decoder.decode(value,{stream:true});
    }
  }finally{reader.releaseLock()}
  return JSON.parse(text+decoder.decode());
}
async function wordpress(publisher,collection,input) {
  const url=new URL('https://'+publisher.host+'/wp-json/wp/v2/'+collection);
  url.search=new URLSearchParams({search:input.employer,per_page:'10',orderby:'relevance',_fields:'title,link,content'}).toString();
  const records=await fetchJson(url,input);
  if(!Array.isArray(records))throw Error('Unexpected publisher response');
  return records.flatMap(row=>{
    const url=officialUrl(row.link,publisher.host);
    if(!url||!row.content?.rendered)return [];
    const result=classify({title:row.title?.rendered,body:paragraphs(row.content.rendered),result:{publisher:publisher.name,url}},input);
    return result?[result]:[];
  });
}
async function nsf(input) {
  const url=new URL('https://api.nsf.gov/services/v1/awards.json');
  url.search=new URLSearchParams({awardeeName:input.employer,keyword:'HBCU',printFields:'id,title,awardeeName,abstractText'}).toString();
  const json=await fetchJson(url,input);
  if(!Array.isArray(json.response?.award))throw Error('Unexpected awards response');
  return json.response.award.flatMap(a=>{
    if(!/^\d{5,10}$/.test(String(a.id))||normalized(a.awardeeName)!==normalized(input.employer))return [];
    const body=plain(a.abstractText);
    if(!blackPath.test(body+' '+a.title)||!opportunity.test(body+' '+a.title)||!localRole(input)(body+' '+a.title)||profile.test(a.title))return [];
    return [{title:plain(a.title),url:'https://www.nsf.gov/awardsearch/showAward?AWD_ID='+a.id,publisher:'U.S. National Science Foundation',kind:'lead',excerpt:'The award names this institution as recipient. Its project abstract describes intended activities; outcomes require a separate source.'}];
  });
}

async function collect(group,input) {
  const outcomes=await Promise.allSettled(group.tasks.map(task=>task(input)));
  if(input.signal.aborted && input.parentSignal?.aborted) throw input.parentSignal.reason;
  return {name:group.name,status:outcomes.every(v=>v.status==='fulfilled')?'ok':'unavailable',
    hadResponse:outcomes.some(v=>v.status==='fulfilled'),
    results:outcomes.flatMap(v=>v.status==='fulfilled'?v.value:[])};
}
export async function discoverSources({employer,title='',profession='',signal,fetchImpl=globalThis.fetch}){
  const name=String(employer||'').trim().replace(/\s+/g,' ').slice(0,160);
  if(normalized(name).length<2 || /^(?:workplace|company|hospital|university|school|employer|self employed|n a|none)$/i.test(normalized(name))){
    return {status:'complete',results:[],providers:[]};
  }
  if(signal?.aborted)throw signal.reason ?? new DOMException('Cancelled','AbortError');
  const timeout=new AbortController();
  const abort=()=>timeout.abort(signal?.reason);
  signal?.addEventListener('abort',abort,{once:true});
  const timer=setTimeout(()=>timeout.abort(new DOMException('Publisher timeout','TimeoutError')),10500);
  const input={employer:name,title:String(title||'').slice(0,120),profession,signal:timeout.signal,parentSignal:signal,fetchImpl};
  const slug=typeof profession==='object'?profession?.slug:profession;
  const chosen=[publishers.tmcf,publishers.uncf];
  if(engineering.includes(slug)||/\b(engineer|engineering|developer)\b/i.test(title))chosen.push(publishers.engineers);
  if(healthcare.includes(slug)||/\b(physician|nurse|healthcare|pharmacist|dentist)\b/i.test(title))chosen.push(publishers.medical);
  const groups=chosen.map(pub=>({name:pub.name,tasks:pub.collections.map(c=>ctx=>wordpress(pub,c,ctx))}));
  groups.push({name:'ERIC · U.S. Department of Education',tasks:[ericSources]});
  if(/\b(university|college|polytechnic|institute of technology)\b/i.test(name))groups.push({name:'U.S. National Science Foundation',tasks:[nsf]});
  try{
    const checked=await Promise.all(groups.map(group=>collect(group,input)));
    if(signal?.aborted)throw signal.reason ?? new DOMException('Cancelled','AbortError');
    const merged=checked.flatMap(c=>c.results).sort((a,b)=>Number(b.kind==='documented')-Number(a.kind==='documented'));
    const seen=new Set();
    const unique=merged.filter(result=>{if(seen.has(result.url))return false;seen.add(result.url);return true}).slice(0,10);
    const status=checked.every(c=>c.status==='ok')?'complete':checked.some(c=>c.hadResponse)?'partial':'unavailable';
    return {status,results:unique,providers:checked.map(({name,status})=>({name,status}))};
  }finally{clearTimeout(timer);signal?.removeEventListener('abort',abort)}
}
