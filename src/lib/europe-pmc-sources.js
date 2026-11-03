// Health literature is a research lead. Authors' affiliations by themselves do
// not establish an employer's training, recruitment or admissions practices.
const fieldTerms={
  physician:/\b(physicians?|doctors?|medical students?|medical education|residency|residents|medical school)\b/i,
  dentist:/\b(dentists?|dental|dentistry)\b/i,
  'registered-nurse':/\b(nurses?|nursing)\b/i,
  pharmacist:/\b(pharmacists?|pharmacy)\b/i,
};
const blackContext=/\b(hbcus?|historically black|black (?:physicians?|nurses?|residents?|students?|health professionals|faculty)|african american)\b/i;
const workforce=/\b(mentorship|mentoring|pathways?|pipeline|workforce|medical education|nursing education|professional training|recruitment of|residency program|medical school|admissions|dentistry program)\b/i;
const plain=s=>String(s||'').replace(/<[^>]*>/g,' ').replace(/&(?:amp|lt|gt|quot|apos|nbsp);/g,x=>({'&amp;':'&','&lt;':'<','&gt;':'>','&quot;':'"','&apos;':"'",'&nbsp;':' '})[x]).replace(/\s+/g,' ').trim();
const norm=s=>plain(s).normalize('NFKD').replace(/\p{M}/gu,'').toLowerCase().replace(/[^\p{L}\p{N}]+/gu,' ').trim();
export async function europePmcSources({employer,title,profession='',signal,fetchImpl=fetch}){
  const company=norm(employer);
  if(!company)return [];
  const role=fieldTerms[profession] || Object.values(fieldTerms).find(pattern=>pattern.test(title));
  if(!role)return [];
  const query='TITLE_ABS:"'+company+'" AND (TITLE_ABS:"historically black" OR TITLE_ABS:"Black physicians" OR TITLE_ABS:"Black nurses" OR TITLE_ABS:"African American" OR TITLE_ABS:HBCU) AND (TITLE_ABS:training OR TITLE_ABS:workforce OR TITLE_ABS:residency OR TITLE_ABS:recruitment OR TITLE_ABS:mentorship OR TITLE_ABS:"medical education")';
  const url=new URL('https://www.ebi.ac.uk/europepmc/webservices/rest/search');
  url.search=new URLSearchParams({query,format:'json',resultType:'core',pageSize:'15'}).toString();
  const response=await fetchImpl(url.href,{signal,credentials:'omit',referrerPolicy:'no-referrer'});
  if(!response.ok)throw Error('Europe PMC unavailable');
  const data=await response.json();
  if(!Array.isArray(data.resultList?.result))throw Error('Invalid Europe PMC response');
  return data.resultList.result.flatMap(r=>{
    const headline=plain(r.title),abstract=plain(r.abstractText);
    const text=headline+' '+abstract;
    if(!/^(MED|PMC|PPR|AGR|CBA|CTX|PAT)$/i.test(r.source)||!/^[A-Za-z\d-]{1,30}$/.test(r.id)||
       !headline||!abstract||/\b(obituary|biography|the life of|in memoriam)\b|\(\d{4}[-–]\d{4}\)/i.test(headline)||
       !(' '+norm(text)+' ').includes(' '+company+' ')||!blackContext.test(text)||!workforce.test(text)||!role.test(text))return [];
    return [{title:headline,url:'https://europepmc.org/article/'+r.source+'/'+r.id,publisher:'Europe PMC · health research',
      excerpt:'The publication mentions this institution, the field and Black professional education or workforce topics. Review the abstract for its scope.',kind:'lead'}];
  }).slice(0,3);
}
