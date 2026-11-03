import {employerKey} from './employer-key.js';
import {pmRoleRecords} from './pm-role-records.js';
import {projectStories} from './project-work.js';

export const pmTitles={
  'product-manager':'Product manager','program-manager':'Program manager','project-manager':'Project manager'
};
export const isPmRole=slug=>Object.hasOwn(pmTitles,slug);
export const boardProvider='Greenhouse · employer job boards';

// Indexed editorial readings are kept distinct from a fresh publisher response.
// Match the institution as named, never an ancestor, subsidiary or similar site.
const product=pmRoleRecords['product-manager'], program=pmRoleRecords['program-manager'];
const reviewed=[
  ['product-manager',['Amazon'],'history','Angelina Howard at Amazon','Amazon',
    'Amazon identifies Howard as a senior product manager on its Digital Video Games team and as president of its Black Employee Network.',
    'Her account documents leadership in both places. It does not establish that the network selected Amazon product managers or led to your appointment.',
    'https://www.aboutamazon.com/news/workplace/why-forbes-is-recognizing-this-amazon-leader'],
  ['program-manager',['Amazon'],'role','How Amazon interviews program managers','Amazon Jobs',
    'Amazon describes the application, screening, writing assessment and interviews for its program managers.',
    'The guide does not identify who opened this role to Black workers, who was hired, or what happened on a particular team.',
    'https://www.amazon.jobs/content/en/how-we-hire/program-manager-interview-prep'],
  ['product-manager',['Atlassian'],'role','How Atlassian interviews product managers','Atlassian',
    'Atlassian describes its panel interviews and the criteria it uses to evaluate product candidates.',
    'It does not name the people who opened product hiring to Black workers or identify who made your team’s hiring decisions.',
    'https://www.atlassian.com/company/careers/resources/career-growth/product-managers'],
  ['product-manager',product.workplaceNames,'history','Kayiita Johnson at Google Nest','Aced (formerly Exponent)',
    'Johnson describes doing product work at Google Nest and starting PM While Black. His interview connects the person, workplace and profession.',
    'It does not show that Google Nest ran his initiative or that it led to your hiring.',product.first.sources[0][1]],
  ['program-manager',program.workplaceNames,'history','Mary W. Jackson at NASA Langley','NASA',
    'NASA places Jackson at Langley and describes her move into the Federal Women’s Program to improve access to hiring and promotion.',
    'The appointment is documented. A link to another program or to your own hiring at Langley is still open.',program.first.sources[0][1]],
  ['project-manager',['NASA Jet Propulsion Laboratory','Jet Propulsion Laboratory','NASA JPL','JPL'],'history','Joseph Hunt at the Jet Propulsion Laboratory','NASA',
    'In NASA’s interview, Hunt describes joining JPL and later managing the Mars Odyssey mission. The record ties a Black project manager to that laboratory.',
    'It documents Hunt’s responsibilities, not who assigned later project leads or how your appointment happened.',projectStories.engineering.url]
];
export function reviewedPmSources(employer,role){
  const exact=employerKey(employer);
  return reviewed.filter(([slug,names])=>slug===role&&names.some(n=>employerKey(n)===exact)).map(([, ,scope,title,publisher,connection,limit,url])=>
    ({title,url,publisher,scope,connection,limit,kind:'documented',mode:'reviewed'}));
}
export function safeRecordUrl(raw){
  try{const u=new URL(raw);return u.protocol==='https:' && !u.username && !u.password ? u.href:null}catch{return null}
}
const listingTitles={
  'product-manager':/\bproduct managers?\b|\b(?:director|head|lead|vp|vice president)(?: of|,) product management\b/i,
  'program-manager':/\bprogram(?:me)? managers?\b|\b(?:director|head|lead)(?: of|,) program management\b/i,
  'project-manager':/\bproject managers?\b|\b(?:director|head|lead)(?: of|,) project management\b/i
};
export async function pmBoardSources({employer,profession,signal,fetchImpl=fetch}){
  const key=employerKey(employer);
  const token=key.replace(/ /g,'');
  if(!/^[a-z0-9]{2,65}$/.test(token)||!isPmRole(profession))return [];
  const base='https://boards-api.greenhouse.io/v1/boards/'+token;
  const options={signal,credentials:'omit',referrerPolicy:'no-referrer',redirect:'manual',headers:{Accept:'application/json'}};
  const meta=await fetchImpl(base,options);
  if(meta.status===404)return [];
  if(!meta.ok)throw Error('Job board unavailable');
  const board=await meta.json();
  if(typeof board?.name!=='string')throw Error('Invalid board');
  if(employerKey(board.name)!==key)return [];
  const res=await fetchImpl(base+'/jobs',options);
  if(!res.ok)throw Error('Job listings unavailable');
  const data=await res.json();
  if(!Array.isArray(data.jobs))throw Error('Invalid listings');
  return data.jobs.flatMap(j=>{
    const title=String(j.title||'').trim(),url=safeRecordUrl(j.absolute_url);
    if(/\b(?:assistant to|recruiter (?:for|to))\b/i.test(title)||!url||!j.internal_job_id||employerKey(j.company_name)!==key||!listingTitles[profession].test(title))return [];
    return [{title,url,publisher:board.name+' · employer posting',kind:'documented',scope:'role',
      publishedOn:/^\d{4}-\d{2}-\d{2}/.test(j.first_published||'')?j.first_published.slice(0,10):undefined,
      connection:board.name+' advertised “'+title+'”'+(j.location?.name?' ('+j.location.name+')':'')+'. This links the employer to the work.',
      limit:'A posting does not say who got the job or who opened this work to Black employees.'}];
  }).sort((a,b)=>(b.publishedOn||'').localeCompare(a.publishedOn||'')).slice(0,3);
}

export function describePmRecord(record){
  if(['history','role'].includes(record.scope))return record;
  const award=record.kind==='documented';
  return {...record,scope:award?'funding':'lead',connection:record.excerpt,
    limit:award?'The funding record does not identify a hire, an appointment or who opened the role at this workplace.':'This is a lead. It does not establish a connection to this role or to your hiring.'};
}
