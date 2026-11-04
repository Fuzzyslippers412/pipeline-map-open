import {pmRoleRecords} from './pm-role-records.js';
import {projectStories,sectorQuestions} from './project-work.js';
import {reviewedPmSources} from './pm-employer-sources.js';

export const evidenceLabels={
  access:'Black access documented',professional:'Black professional’s role documented',
  role:'Role or hiring process documented',posting:'Role advertised',process:'Hiring process described',funding:'Institutional funding documented',lead:'Lead to investigate'
};
export function evidenceKind(record){
  // A historical person at an employer is not sufficient evidence of opening access.
  if(record.scope==='history')return record.evidence==='access'?'access':'professional';
  if(record.scope==='role'&&['posting','process'].includes(record.evidence))return record.evidence;
  return ['role','funding'].includes(record.scope)?record.scope:'lead';
}
export function evidenceLabel(record){return evidenceLabels[evidenceKind(record)]}

const opportunities={
  'product-manager': ['Information and mentorship','Johnson reports offers of mentorship and employer interest in including Black professionals in candidate pools.'],
  'program-manager': ['A voice in hiring and promotion','Jackson used her program position to advocate for opportunities for women and minority employees.'],
  general:['Professional learning and peers','Watkins built a network for Black women working in project management.'],
  construction:['Authority on a major project','Howard helped lead the museum project’s design team and consultants.'],
  engineering:['Responsibility for a mission','Hunt describes directing the Mars Odyssey extended mission and coordinating its resources.'],
  community:['Responsibility for organizing','Randolph entrusted Rustin with day-to-day planning for the march.']
};
export function pmPathStory(role,sector='general'){
  const record=pmRoleRecords[role];
  const key=record?role:Object.hasOwn(projectStories,sector)?sector:'general';
  const s=record?.first||projectStories[key];
  const projectQuestion=sectorQuestions[sector]||sectorQuestions.general;
  const split=projectQuestion.indexOf('?');
  return {
    role,name:record?.name||'Project manager',person:s.person,date:s.date||s.year,place:s.place,
    opportunity:opportunities[key][0],change:opportunities[key][1],
    evidence:record||key==='general'?'access':'professional',
    sources:s.sources||[[s.source,s.url]],
    comparison:key==='community'?'Rustin’s title was deputy director. The comparison to project management is about duties.':
      !record&&key==='general'&&sector!=='general'?'This is a record across project management. A connection to your sector needs evidence.':
      'This comparison does not establish how you entered the role.',
    question:record?.question||projectQuestion.slice(0,split+1),
    next:record?.next||projectQuestion.slice(split+1).trim()
  };
}
export function workplaceStep(role,employer,sector='general',records=[]){
  const story=pmPathStory(role,sector);
  if(!employer?.trim())return {label:'Workplace not entered',description:'Add your exact workplace to look for a local record.',link:'open',record:null};
  const candidates=records.length?records:reviewedPmSources(employer,role);
  const found=candidates.find(r=>['history','role','funding'].includes(r.scope));
  if(!found)return {label:'Still open at '+employer,description:'Which record connects this work to Black access here?',link:'open',record:null};
  const same=found.scope==='history'&&story.sources.some(([,url])=>url===found.url);
  return {
    label:employer,description:same?'This source names the historical workplace. Your appointment still needs its own record.':
      found.scope==='history'?'A separate workplace record is available. Its connection to the example above is still open.':
      found.scope==='role'?'The role is documented here. Who opened access to Black workers is still open.':
      'A funding record names this employer. Hiring and appointment decisions remain open.',
    link:'open',record:found
  };
}
export function pmResearchStatus(report,employer,matches){
  const suffix=report.status==='partial'?' Some publishers could not be checked.':
    report.status==='unavailable'?' Live publishers could not be checked.':'';
  if(matches.length){
    const historical=matches.some(r=>r.scope==='history');
    return (historical?'Workplace history found.':matches.some(r=>r.scope==='role')?'The role is documented; the access story is still open.':
      'Records found; the workplace connection still needs checking.')+suffix;
  }
  if(!report.providers.length)return 'Use the exact workplace name to start a search.';
  if(report.status==='unavailable')return 'Live searches could not finish. No matching reviewed or indexed record was found. The gap stays open.';
  const board=report.providers.find(p=>p.coverage);
  if(board?.coverage==='identity-mismatch')return 'The job board did not match this workplace. No connection found in the other checked sources.'+suffix;
  if(board?.coverage==='not-found')return 'No matching job board or relevant workplace record found in the sources checked. The gap stays open.'+suffix;
  return 'No relevant record found in the sources checked. That does not mean no history exists.'+suffix;
}
export const boardCoverage={
  'not-found':'No job board was identified for the entered name. This is not a search of every employer archive.',
  'identity-mismatch':'The board name differed from your workplace. Its records were excluded.',
  'no-role':'The board matched the employer, but no posting for the selected role was returned.',
  'matched':'The board and posting company matched the employer name.'
};
