import assert from 'node:assert/strict';
import fs from 'node:fs';
import test from 'node:test';
import {resolveTitle} from '../src/lib/title-resolver.js';
import {suggestJobTitles} from '../src/lib/title-suggestions.js';
import {packDirectory,WorkplaceSearch} from '../src/lib/workplace-search.js';
import {saveTrace,readTrace,findWorkplaceLinks} from '../src/lib/trace-context.js';
import {buildCareerTimeline} from '../src/lib/career-timeline.js';
const load=p=>JSON.parse(fs.readFileSync(new URL(p,import.meta.url)));
const professions=load('../data/professions.json'),directory=load('../public/data/job-occupations.json'),links=load('../data/workplace-links.json');

// Explicit expectations exercise real reported failures and distinct credentials.
const cases=[
 ['home health aide','31-1121.00'],['HHA','31-1121.00'],['CNA','31-1131.00'],['certified nursing assistant','31-1131.00'],['LPN','29-2061.00'],['LVN','29-2061.00'],
 ['medical assistant','31-9092.00'],['respiratory therapist','29-1126.00'],['radiology tech','29-2034.00'],['phlebotomist','31-9097.00'],
 ['barber','39-5011.00'],['hair stylist','39-5012.00'],['customer service rep','43-4051.00'],['CSR','43-4051.00'],['retail associate','41-2031.00'],['retail manager','41-1011.00'],
 ['accountant','13-2011.00'],['CPA','13-2011.00'],['bookkeeper','43-3031.00'],['payroll specialist','43-3051.00'],['HR generalist','13-1071.00'],
 ['mail carrier','43-5052.00'],['postal clerk','43-5051.00'],['mail handler','43-5053.00'],['CDL driver','53-3032.00'],['HVAC tech','49-9021.00'],['plumber','47-2152.00'],['welder','51-4121.00'],
 ['farmer','11-9013.00'],['farm manager','11-9013.00'],['crop worker','45-2092.00'],['ranch hand','45-2093.00'],['agronomist','19-1013.00'],['agricultural tech','19-4012.00'],['extension agent','25-9021.00']
];
test('everyday titles resolve to the intended occupation online and with the large directory unavailable',()=>{
 for(const d of [null,directory])for(const [title,code] of cases){
  const r=resolveTitle(title,professions,d);assert.equal(r.occupations?.[0]?.code,code,title);assert.equal(r.title,title);
 }
 assert.equal(resolveTitle('nurse practitioner',professions,directory).occupations[0].code,'29-1171.00');
 assert.equal(resolveTitle('RN',professions,directory).slug,'registered-nurse');
});
test('canonical singulars outrank broad alternate-title links without blindly stemming unfamiliar titles',()=>{
 for(const [a,b] of [['barber','Barbers'],['home health aide','Home Health Aides'],['respiratory therapist','Respiratory Therapists'],['phlebotomist','Phlebotomists']]){
  assert.equal(resolveTitle(a,professions,directory).occupations[0].code,resolveTitle(b,professions,directory).occupations[0].code);
 }
 for(const t of ['quantum clerical wizard 711','physics','nurse recruiter','assistant to the governor'])assert.notEqual(resolveTitle(t,professions,directory).kind,'exact',t);
});
test('spelling corrections require a choice and unknown wording remains available',()=>{
 for(const [typed,wanted] of [['registerd nurse','registered-nurse'],['govenor','governor'],['agriclture','agriculture']]){
  const r=resolveTitle(typed,professions,directory);assert.equal(r.kind,'choices');assert.equal(r.correction,true);
  assert.ok(r.choices.some(c=>c.result.slug===wanted));assert.ok(r.choices.some(c=>c.result.kind==='unknown'&&c.result.title===typed));
  assert.ok(suggestJobTitles(typed,professions,directory).length);
 }
 assert.equal(resolveTitle('Personal studio role 997',professions,directory).kind,'unknown');
});
test('ambiguous work uses bounded choices and does not infer a credential or management level',()=>{
 for(const t of ['case manager','data analyst','warehouse associate','patient care tech','postal worker','farmworker','politics']){
  const r=resolveTitle(t,professions,directory);assert.equal(r.kind,'choices',t);assert.ok(r.choices.length<=4,t);
  assert.ok(r.choices.some(c=>c.result.kind==='unknown'),t);
 }
 assert.equal(resolveTitle('CNA',professions,directory).slug,undefined);
 assert.equal(resolveTitle('LPN',professions,directory).slug,undefined);
});
test('agriculture roles remain distinct and state governor does not swallow other uses of governor',()=>{
 for(const t of ['farmer','crop worker','agronomist']){const r=resolveTitle(t,professions,directory);assert.equal(r.kind,'related');assert.equal(r.slug,'agriculture')}
 for(const t of ['governor','Governor of Georgia','Florida governor','governor-elect'])assert.equal(resolveTitle(t,professions,directory).slug,'governor');
 for(const t of ['Federal Reserve governor','governor campaign manager','lieutenant governor'])assert.notEqual(resolveTitle(t,professions,directory).slug,'governor');
});
test('stable workplace identity survives packing, selection and a stored trace without leaking personal values into a URL',()=>{
 const index=new WorkplaceSearch();index.add(packDirectory([
  {id:'site-a',name:'Central School',location:'A, GA',parent:'A District',source:'schools'},
  {id:'site-b',name:'Central School',location:'B, GA',parent:'B District',source:'schools'}
 ],{schools:{url:'https://nces.ed.gov/ccd/schoolsearch/'}}));
 const selected=index.search('central B')[0];assert.equal(selected.id,'site-b');assert.equal(selected.sourceUrl,'https://nces.ed.gov/ccd/schoolsearch/');
 const values=new Map();globalThis.window={sessionStorage:{getItem:k=>values.get(k)||null,setItem:(k,v)=>values.set(k,v)}};
 try{
  const info={workplace:selected.value,id:selected.id,parent:selected.parent,location:selected.location,sourceUrl:selected.sourceUrl,relation:'School district'};
  assert.equal(saveTrace({title:'My custom teacher title',lookupTitle:'Public school teacher',workplace:selected.value,workplaceInfo:info,slug:'k12-teacher',match:'title'}),true);
  assert.equal(readTrace().title,'My custom teacher title');assert.deepEqual(readTrace().workplaceInfo,info);
  const rows=[{workplace:'Central School',aliases:[],professions:['k12-teacher'],site:{id:'site-a',location:'A, GA',parent:'A District'}}];
  assert.deepEqual(findWorkplaceLinks(selected.value,'k12-teacher',rows,info),[]);
  assert.equal(findWorkplaceLinks('Renamed school','k12-teacher',rows,{workplace:'Renamed school',id:'site-a'}).length,1);
 }finally{delete globalThis.window}
});
test('Tuskegee appointment records connect relevant agricultural work without assigning the same history to a hired farmworker',()=>{
 const context={employer:'Tuskegee University',title:'Agronomist',profession:'agriculture',related:true,occupationCode:'19-1013.00',workplaceInfo:{workplace:'Tuskegee University',id:'ipeds-102377'}};
 assert.equal(findWorkplaceLinks(context.employer,'agriculture',links,context.workplaceInfo,context).length,1);
 assert.equal(findWorkplaceLinks(context.employer,'agriculture',links,context.workplaceInfo,{...context,occupationCode:'45-2092.00'}).length,0);
 const timeline=buildCareerTimeline({context,field:{slug:'agriculture',name:'Agriculture',reviewers:links,historical:[]}});
 assert.ok(timeline.some(r=>r.type==='employer'&&r.title.includes('Carver')));
 assert.ok(timeline.some(r=>r.type==='gap'&&r.title==='Your route into this job'));
 assert.equal(findWorkplaceLinks('A private farm','agriculture',links,null,context).length,0);
});
test('the governor history dates election reporting and keeps officeholding separate from worker outcomes',()=>{
 const g=load('../data/history/governor.json');
 for(const e of g.events.filter(e=>e.year===2026)){
  assert.equal(e.checkedOn,'2026-11-04');assert.match(e.evidenceStatus,/not yet sworn/);assert.match(e.limit,/certification/);
 }
 assert.ok(g.events.some(e=>e.id.includes('wilder')&&e.year===1989));
});

test('new state office records stay with their exact office and do not become staff hiring evidence',()=>{
 for(const state of ['New York','Massachusetts','Louisiana']){
  const employer=state+' Governor’s Office', id='reviewed-governor-office-'+state.toLowerCase().replaceAll(' ','-');
  const info={workplace:employer,id};
  assert.equal(findWorkplaceLinks(employer,'governor',links,info).length,1);
  assert.equal(findWorkplaceLinks(employer,'elected-official',links,info).length,0);
  assert.equal(findWorkplaceLinks(employer,'governor',links,{...info,id:'different-public-office'}).length,0);
  assert.equal(findWorkplaceLinks('State of '+state,'governor',links).length,0);
  const timeline=buildCareerTimeline({context:{employer,title:'Governor',profession:'governor',workplaceInfo:info},field:{slug:'governor',name:'Governor',reviewers:links,historical:[]}});
  assert.ok(timeline.some(row=>row.type==='employer'&&row.sourceNote.includes('not a hiring or appointment route for staff')));
  assert.ok(timeline.some(row=>row.type==='gap'&&row.title==='Your route into this job'));
 }
});
