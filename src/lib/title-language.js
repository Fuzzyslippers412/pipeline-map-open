import {normalizeJobTitle} from './job-match.js';

// Reviewed navigation vocabulary. Codes identify occupations, not historical coverage.
// The bundled O*NET directory remains the source for occupational definitions.
export const everydayTitles = [
 ['Home health aide','31-1121.00','Home Health Aides',['HHA','home care aide']],
 ['Nursing assistant','31-1131.00','Nursing Assistants',['CNA','certified nursing assistant','certified nurse aide','nurses aide','nurse aide']],
 ['Licensed practical nurse','29-2061.00','Licensed Practical and Licensed Vocational Nurses',['LPN','LVN','licensed vocational nurse']],
 ['Medical assistant','31-9092.00','Medical Assistants',['medical office assistant']],
 ['Respiratory therapist','29-1126.00','Respiratory Therapists',['respiratory therapy','respiratory care practitioner']],
 ['Radiology technician','29-2034.00','Radiologic Technologists and Technicians',['radiology tech','radiologic technologist','x ray tech','xray technician']],
 ['Phlebotomist','31-9097.00','Phlebotomists',['phlebotomy technician','phlebotomy tech']],
 ['Barber','39-5011.00','Barbers',[]],
 ['Hairstylist','39-5012.00','Hairdressers, Hairstylists, and Cosmetologists',['hair stylist','hairdresser','cosmetologist']],
 ['Customer service representative','43-4051.00','Customer Service Representatives',['customer service rep','customer support representative','customer support rep','CSR']],
 ['Retail associate','41-2031.00','Retail Salespersons',['retail sales associate','sales associate','retail salesperson']],
 ['Retail manager','41-1011.00','First-Line Supervisors of Retail Sales Workers',['retail store manager','store supervisor']],
 ['Accountant','13-2011.00','Accountants and Auditors',['CPA','certified public accountant','staff accountant']],
 ['Bookkeeper','43-3031.00','Bookkeeping, Accounting, and Auditing Clerks',['book keeper','accounting clerk','accounts payable clerk','accounts receivable clerk']],
 ['Payroll specialist','43-3051.00','Payroll and Timekeeping Clerks',['payroll clerk','payroll administrator']],
 ['Human resources specialist','13-1071.00','Human Resources Specialists',['HR specialist','HR generalist','human resources generalist']],
 ['Mail carrier','43-5052.00','Postal Service Mail Carriers',['USPS mail carrier','postal carrier','letter carrier','postal delivery worker']],
 ['Postal clerk','43-5051.00','Postal Service Clerks',['USPS clerk','post office clerk']],
 ['Mail handler','43-5053.00','Postal Service Mail Sorters, Processors, and Processing Machine Operators',['USPS mail handler','postal mail handler','mail processing clerk']],
 ['CDL driver','53-3032.00','Heavy and Tractor-Trailer Truck Drivers',['tractor trailer driver','long haul truck driver']],
 ['HVAC technician','49-9021.00','Heating, Air Conditioning, and Refrigeration Mechanics and Installers',['HVAC tech','heating and cooling technician']],
 ['Plumber','47-2152.00','Plumbers, Pipefitters, and Steamfitters',[]],
 ['Welder','51-4121.00','Welders, Cutters, Solderers, and Brazers',[]],
 ['Construction laborer','47-2061.00','Construction Laborers',['construction labourer']],
 ['Farmer','11-9013.00','Farmers, Ranchers, and Other Agricultural Managers',['farm owner','farm manager','rancher','ranch manager','grower']],
 ['Crop farmworker','45-2092.00','Farmworkers and Laborers, Crop, Nursery, and Greenhouse',['crop worker','farm laborer','farm labourer','field worker','greenhouse worker']],
 ['Livestock farmworker','45-2093.00','Farmworkers, Farm, Ranch, and Aquacultural Animals',['ranch hand','livestock worker','dairy farm worker']],
 ['Agronomist','19-1013.00','Soil and Plant Scientists',['soil scientist','plant scientist','agricultural scientist']],
 ['Agricultural technician','19-4012.00','Agricultural Technicians',['agriculture technician','agricultural tech']],
 ['Agricultural equipment operator','45-2091.00','Agricultural Equipment Operators',['farm equipment operator','tractor operator']],
 ['Agricultural extension educator','25-9021.00','Farm and Home Management Educators',['extension agent','agricultural extension agent']],
];
const byTerm = new Map();
for(const [title,code,name,aliases] of everydayTitles){
 for(const term of [title,...aliases])byTerm.set(normalizeJobTitle(term),{code,name});
}
export const everydayOccupation = key => byTerm.get(key);

// Generate forms only for known occupational nouns in official names. Do not
// stem the reader's input: words such as "analysis" and "physics" stay intact.
export function canonicalTitleForms(name){
 const key=normalizeJobTitle(name);
 const words=key.split(' ');
 const last=words.at(-1);
 const nouns=new Set('aides assistants therapists technologists technicians phlebotomists barbers stylists nurses practitioners pharmacists physicians dentists lawyers engineers teachers professors journalists reporters developers programmers scientists analysts specialists managers executives officers governors legislators workers operators drivers clerks tellers cashiers cooks chefs bakers mechanics plumbers electricians welders carpenters painters inspectors accountants auditors bookkeepers planners counselors coordinators instructors designers librarians supervisors dispatchers interpreters translators farmers ranchers foresters'.split(' '));
 if(!nouns.has(last))return [key];
 words[words.length-1]=last.slice(0,-1);
 return [key,words.join(' ')];
}

// One adjacent transposition, insertion, deletion or replacement. Longer titles
// may have two errors, but corrections always require the reader's selection.
function editDistance(a,b,max){
 if(Math.abs(a.length-b.length)>max)return max+1;
 let older,previous=Array.from({length:b.length+1},(_,i)=>i);
 for(let i=1;i<=a.length;i++){
  const row=[i];let minimum=i;
  for(let j=1;j<=b.length;j++){
   row[j]=Math.min(row[j-1]+1,previous[j]+1,previous[j-1]+Number(a[i-1]!==b[j-1]));
   if(i>1&&j>1&&a[i-1]===b[j-2]&&a[i-2]===b[j-1])row[j]=Math.min(row[j],older[j-2]+1);
   minimum=Math.min(minimum,row[j]);
  }
  if(minimum>max)return max+1;
  older=previous;previous=row;
 }
 return previous[b.length];
}
export function spellingSuggestions(value,titles,limit=3){
 const query=normalizeJobTitle(value),parts=query.split(' ');
 if(query.length<5||query.length>70||/\d/.test(query))return [];
 const max=query.length>=10?2:1,seen=new Set(),candidates=[];
 for(const title of titles){
  const key=normalizeJobTitle(title);
  if(seen.has(key)||key===query||key.split(' ').length!==parts.length)continue;
  seen.add(key);
  const cost=editDistance(query,key,max);
  if(cost<=max)candidates.push({title,cost});
 }
 return candidates.sort((a,b)=>a.cost-b.cost||a.title.length-b.title.length||a.title.localeCompare(b.title)).slice(0,limit).map(r=>r.title);
}
