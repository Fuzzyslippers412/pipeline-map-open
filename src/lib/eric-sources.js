import {sourceDate} from './source-date.js';
// ERIC indexes education and workforce research from many publishers. Its
// abstracts can point readers to evidence, but do not establish employment.
const ignored = new Set('and at of for the in to plc llc inc incorporated corporation company senior junior chief lead assistant associate staff manager director specialist level'.split(' '));
const blackAccess = /\b(?:hbcus?|historically black|african americans?|black (?:students?|educators?|teachers?|workers?|professionals?|graduates?|colleges?|faculty|nurs\w*|engineers?|women|men))\b/i;
const careerPath = /\b(?:mentor\w*|apprentice\w*|internship\w*|recruit\w*|workforce|profession\w*|career\w*|faculty|employment|hiring|pipeline\w*|teacher preparation|training|occupational|college access)\b/i;

function plain(value) {
  return String(value ?? '').replace(/<[^>]*>/g,' ').replace(/&(?:amp|quot|apos|lt|gt|nbsp);/g,s=>({'&amp;':'&','&quot;':'"','&apos;':"'",'&lt;':'<','&gt;':'>','&nbsp;':' '})[s]).replace(/\s+/g,' ').trim();
}
function norm(s) {
  return plain(s).normalize('NFKD').replace(/\p{M}/gu,'').toLowerCase().replace(/[^\p{L}\p{N}]+/gu,' ').trim();
}
function excerptFrom(text, company) {
  const sentences = text.split(/(?<=[.!?])\s+/).filter(Boolean);
  const rank = s => Number((' '+norm(s)+' ').includes(' '+company+' '))*2+Number(blackAccess.test(s))+Number(careerPath.test(s));
  const selected = sentences.sort((a,b)=>rank(b)-rank(a))[0] || '';
  const words=selected.split(' ');
  return words.slice(0,24).join(' ')+(words.length>24?'…':'');
}

export async function ericSources({employer,title,profession='',signal,fetchImpl=fetch}) {
  // ERIC query syntax applies only to fixed search terms. Supply a cleaned
  // quoted employer phrase; the reader's title and profession stay local.
  const company=norm(employer).slice(0,160);
  if(!company||!company.split(' ').some(w=>!ignored.has(w))) return [];
  const query='"'+company+'" AND (HBCU OR "historically black" OR "African American" OR "Black professionals")';
  const url=new URL('https://api.ies.ed.gov/eric/');
  url.search=new URLSearchParams({search:query,format:'json',rows:'16'}).toString();
  const response=await fetchImpl(url.href,{signal,credentials:'omit',referrerPolicy:'no-referrer'});
  if(!response.ok) throw new Error('ERIC search unavailable');
  const data=await response.json();
  if(!Array.isArray(data?.response?.docs)) throw new Error('ERIC returned an unreadable index response');
  const roles=[...new Set(norm((title||'')+' '+profession).split(' ').filter(t=>t.length>=3&&!ignored.has(t)))];
  const results=[];
  for(const record of data.response.docs){
    if(!/^(?:ED|EJ)\d+$/.test(record.id))continue;
    const headline=plain(record.title), description=plain(record.description);
    if(!headline||!description)continue;
    const text=headline+' '+description;
    const hay=' '+norm(text)+' ';
    if(!hay.includes(' '+company+' ')||!blackAccess.test(text)||!careerPath.test(text))continue;
    const match=roles.filter(t=>hay.includes(' '+t+' ')||hay.includes(' '+t+'s ')).length;
    if(!match)continue;
    results.push({rank:match, item:{title:headline,url:'https://eric.ed.gov/?id='+record.id,publisher:'ERIC · education research index',excerpt:excerptFrom(description,company),kind:'lead',...sourceDate(record.publicationdateyear,'publication','Publication date')}});
  }
  return results.sort((a,b)=>b.rank-a.rank).slice(0,3).map(x=>x.item);
}
