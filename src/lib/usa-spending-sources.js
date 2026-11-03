// USAspending records identify a legal award recipient. They can substantiate
// funding for named activities, never the employment history of an individual.
const codes={grants:['02','03','04','05'],contracts:['A','B','C','D']};
const normalize=value=>String(value||'').normalize('NFKD').replace(/\p{M}/gu,'').toLowerCase().replace(/[^\p{L}\p{N}]+/gu,' ').trim();
const recipient=value=>normalize(value).replace(/^(?:the) /,'').replace(/ (?:incorporated|inc|llc|corp|corporation)$/, '').trim();
const blackAccess=/\b(hbcus?|historically black|black (?:students?|professionals?|teachers?|medical|engineers?|nurses?|workforce)|african americans?)\b/i;
const program=/\b(trainees?|training|internships?|workforce development|fellowships?|teacher preparation|recruitment|residency|apprenticeships?|education program|mentoring|scholarships?|career pathways?)\b/i;
const roles={
 engineer:/\b(engineers?|engineering)\b/i,'software-engineer':/\b(software|computer science|computer programming)\b/i,
 'k12-teacher':/\b(teachers?|teaching workforce)\b/i,professor:/\b(faculty|professors?)\b/i,
 physician:/\b(physicians?|medical school|medical residenc\w*)\b/i,'registered-nurse':/\b(nurses?|nursing)\b/i,
 lawyer:/\b(law school|attorneys?|lawyers?)\b/i,pharmacist:/\b(pharmacy|pharmacists?)\b/i,dentist:/\b(dental|dentists?)\b/i,
};
export async function usaSpendingSources({employer,title,profession='',signal,fetchImpl=fetch},type='grants'){
 const name=recipient(employer);if(!name||!codes[type])return [];
 const filters={recipient_search_text:[String(employer).trim()],keywords:['HBCU','historically black colleges'],award_type_codes:codes[type]};
 const response=await fetchImpl('https://api.usaspending.gov/api/v2/search/spending_by_award/',{method:'POST',credentials:'omit',referrerPolicy:'no-referrer',signal,headers:{'Content-Type':'application/json',Accept:'application/json'},body:JSON.stringify({filters,fields:['Award ID','Recipient Name','Description','Start Date'],sort:'Start Date',order:'desc',limit:30,page:1})});
 if(!response.ok)throw Error('Federal awards API unavailable');
 const data=await response.json();
 if(!Array.isArray(data.results))throw Error('Federal awards response missing');
 const matches=[];
 for(const row of data.results){
  const org=String(row['Recipient Name']||'').trim(),id=row.generated_internal_id;
  if(recipient(org)!==name || !/^(?:ASST_NON|ASST_AGG|CONT_AWD)_[a-zA-Z0-9_-]+$/.test(id||''))continue;
  const description=String(row.Description||'').replace(/\s+/g,' ').trim();
  if(!blackAccess.test(description)||!program.test(description))continue;
  const sentences=description.split(/(?<=[.!?])\s+|\s+-\s+/);
  const field=roles[profession];
  const roleRelevant=s=>field?field.test(s):normalize(title).length>3&&(' '+normalize(s)+' ').includes(' '+normalize(title)+' ');
  if(!roleRelevant(description))continue;
  const explicit=sentences.some(s=>blackAccess.test(s)&&roleRelevant(s)&&program.test(s)&&!/\b(no funding|cancelled|canceled|terminated|not awarded)\b/i.test(s));
  const date=String(row['Start Date']||'').slice(0,10);
  const award=String(row['Award ID']||id);
  matches.push({title:'Federal award '+award+' to '+org,url:'https://www.usaspending.gov/award/'+encodeURIComponent(id),
   publisher:'USAspending · federal awards',kind:explicit?'documented':'lead',publishedOn:/^\d{4}-\d{2}-\d{2}$/.test(date)?date:undefined,
   excerpt:explicit?'The record names this employer as the award recipient. Its description connects Black institutional access, training and the profession. The award documents funding; it does not establish who participated.':'The award names this employer as recipient. Read the award description to check the connection to the entered role.'});
 }
 return matches.sort((a,b)=>Number(b.kind==='documented')-Number(a.kind==='documented')).slice(0,4);
}
