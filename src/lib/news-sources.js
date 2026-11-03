// The public GDELT DOC index searches recent news coverage across publishers.
// Headline matches remain leads; the service does not fetch publisher pages.
const clean=s=>String(s||'').normalize('NFKD').replace(/\p{M}/gu,'').replace(/[^\p{L}\p{N}]+/gu,' ').trim().toLowerCase();
const access=/\b(hbcu|hbcus|historically black|black professionals|black workers|black engineers|black nurses|african american|black colleges)\b/i;
const opportunity=/\b(scholarships?|fellowships?|internships?|apprentice\w*|mentorship|workforce|professional training|partnership|pipeline|recruitment|college access|career\w*)\b/i;
export async function newsSources({employer,signal,fetchImpl=fetch}){
  const company=clean(employer);
  if(!company)return [];
  const url=new URL('https://api.gdeltproject.org/api/v2/doc/doc');
  const query='"'+company+'" (HBCU OR "historically black" OR "Black professionals") sourcelang:english';
  url.search=new URLSearchParams({query,mode:'artlist',format:'json',maxrecords:'15',timespan:'3m'}).toString();
  const response=await fetchImpl(url.href,{signal,credentials:'omit',referrerPolicy:'no-referrer'});
  if(!response.ok)throw Error('GDELT unavailable');
  const json=await response.json();
  if(!json || typeof json!=='object' || Array.isArray(json))throw Error('Invalid GDELT response');
  if(!Object.keys(json).length)return [];
  if(!Array.isArray(json.articles))throw Error('Invalid GDELT articles');
  return json.articles.flatMap(a=>{
    const title=String(a.title||'').trim(), normalized=clean(title);
    if(!(' '+normalized+' ').includes(' '+company+' ') || !access.test(normalized)||!opportunity.test(normalized)||
       /\b(meet the|spotlight|profile|obituary|interview with|honoree)\b/i.test(title))return [];
    let link;try{link=new URL(a.url)}catch{return []}
    if(link.protocol!=='https:'||link.username||link.password||!a.domain||
       !(link.hostname===a.domain||link.hostname.endsWith('.'+a.domain)))return [];
    return [{title,url:link.href,publisher:'GDELT · '+a.domain,excerpt:'Recent news headline indexed by GDELT. Open the publisher’s article to check the role and institutional connection.',kind:'lead'}];
  }).slice(0,3);
}
