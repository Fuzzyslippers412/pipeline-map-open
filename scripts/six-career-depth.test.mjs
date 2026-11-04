import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {findWorkplaceLinks} from '../src/lib/trace-context.js';
import {buildCareerTimeline} from '../src/lib/career-timeline.js';
import {buildTimelinePreview} from '../src/lib/timeline-preview.js';
import {resolveTitle} from '../src/lib/title-resolver.js';
import {timelineHistory} from '../src/lib/field-history.js';
import {professions} from '../src/lib/model.js';
import {GET} from '../src/pages/data/workplaces/[part].json.js';
import {WorkplaceSearch} from '../src/lib/workplace-search.js';

const read=path=>JSON.parse(readFileSync(new URL(path,import.meta.url)));
const rows=read('../data/workplace-links.json');
const directory=read('../public/data/job-occupations.json');
const fields=['physician','lawyer','dentist','pharmacist','engineer','professor'];
const fresh=rows.filter(r=>r.reviewedOn==='2026-11-04'&&r.historyEventId&&fields.includes(r.professions[0]));
function trace(row,options={}){
 const slug=row.professions[0],p=professions.find(p=>p.slug===slug);
 const context={employer:row.workplace,title:p.name,profession:slug,workplaceInfo:{workplace:row.workplace,id:row.site.id},...options};
 const steps=buildCareerTimeline({context,field:{slug,name:p.name,historical:timelineHistory(p),reviewers:rows}});
 return {steps,preview:buildTimelinePreview({steps,context})};
}
test('six expanded careers connect 17 reviewed workplace episodes and retain the reader’s route gap',()=>{
 assert.equal(fresh.length,17);
 for(const slug of fields)assert.ok(fresh.filter(r=>r.professions.includes(slug)).length>=2,slug);
 for(const row of fresh){
  const {steps,preview}=trace(row);
  assert.ok(steps.some(s=>s.type==='employer'&&s.historyEventId===row.historyEventId&&s.connectsHistory),row.headline);
  assert.deepEqual(preview.gaps.kinds,['route'],row.headline);
  assert.ok(preview.workplace.sources.length,row.headline);
  assert.equal(preview.workplace.connectsHistory,true,row.headline);
  assert.ok(row.sourceNote&&row.roleScope,row.headline);
  if(row.historyEventId==='dummett-meharry-dean-1947'){
   const program=steps.find(s=>s.type==='employer'&&s.scope==='program');
   assert.equal(program.date,'Start date undocumented');assert.equal(program.order,null);
   assert.match(preview.workplace.title,/Dummett/);
  }
  const conflict={workplace:row.workplace,id:'unrelated-workplace'};
  assert.deepEqual(findWorkplaceLinks(row.workplace,row.professions[0],[row],conflict),[],row.headline);
 }
});
test('named historical employment outranks a current training program in the Boeing preview',()=>{
 const row=fresh.find(r=>r.historyEventId==='braithwaite-boeing-engineer-1966');
 const {steps,preview}=trace(row);
 assert.ok(steps.some(s=>s.type==='employer'&&s.scope==='program'));
 assert.match(preview.opening.title,/Braithwaite/);
 assert.match(preview.workplace.title,/Braithwaite/);
 assert.match(preview.workplace.sourceNote,/company-level/);
});
test('a specialty selects the matching workplace record without borrowing a different department’s history',()=>{
 const cases=[['blackwell-berkeley-faculty-1954','25-1022.00','25-1052.00'],['allison-davis-chicago-faculty-1942','25-1081.00','25-1022.00'],['hewitt-montana-faculty-1961','25-1022.00','25-1081.00'],['bath-ucla-drew-1974','29-1241.00','29-1218.00'],['dickens-penn-leadership-1965','29-1218.00','29-1241.00']];
 for(const [id,occupationCode,wrongCode] of cases){
  const row=fresh.find(r=>r.historyEventId===id);
  assert.deepEqual(trace(row,{related:true,occupationCode}).preview.gaps.kinds,['route'],id);
  assert.ok(trace(row,{related:true,occupationCode:wrongCode}).preview.gaps.kinds.includes('workplace'),id);
  assert.ok(trace(row,{related:true}).preview.gaps.kinds.includes('workplace'),id);
 }
});
test('academic, corporate and organizational records do not apply to another employer or campus',()=>{
 const cases=[['motley-ldf-practice-1945','NAACP'],['bolin-nyc-law-department-1937','City of New York'],['bath-ucla-drew-1974','UCLA Health'],['dickens-penn-leadership-1965','Hospital of the University of Pennsylvania'],['sullivan-morehouse-program-1975','Morehouse College'],['cooper-howard-leadership-1938','Howard University Hospital'],['sinkford-howard-dean-1975','Howard University Hospital'],['blackwell-berkeley-faculty-1954','University of California'],['hewitt-montana-faculty-1961','Montana State University'],['mary-jackson-engineer-1958','NASA Glenn Research Center'],['clark-tsu-engineering-1956','Middle Tennessee State University'],['champion-memphis-pharmacy-1981','Champion Pharmacy in another state']];
 for(const [id,employer] of cases){
  const row=fresh.find(r=>r.historyEventId===id);
  assert.deepEqual(findWorkplaceLinks(employer,row.professions[0],[row]),[],employer);
 }
});
test('new reviewed legal and pharmacy workplaces are selectable with their own source and ID',async()=>{
 const index=new WorkplaceSearch();index.add(await GET({params:{part:'main'}}).json());
 for(const [query,id] of [['NYC Law Department','reviewed-nyc-law-department'],['Legal Defense Fund','reviewed-legal-defense-fund'],["Champion's Pharmacy Memphis",'reviewed-champions-pharmacy-memphis'],['Boeing','sec-12927']]){
  const found=index.search(query)[0];
  assert.equal(found?.id,id,query);assert.ok(found?.sourceUrl,query);
 }
});
test('related academic and medical fields preserve the entered title and distinct occupations',()=>{
 for(const [title,slug,code] of [['math professor','professor','25-1022.00'],['chemistry professor','professor','25-1052.00']]){
  const result=resolveTitle(title,professions,directory);
  assert.equal(result.kind,'related');assert.equal(result.title,title);assert.equal(result.slug,slug);assert.equal(result.occupations[0].code,code);
 }
 const eye=resolveTitle('ophthalmologist',professions,directory).choices.find(c=>c.result.occupations?.[0].code==='29-1241.00').result;
 assert.equal(eye.slug,'physician');assert.equal(eye.kind,'related');
 for(const title of ['dental hygienist','physician assistant','pharmacy technician']){
  const result=resolveTitle(title,professions,directory);assert.equal(result.kind,'recognized');assert.equal(result.slug,undefined);
 }
});
test('expanded histories never fill an unknown workplace gap or overwrite a reader’s title',()=>{
 for(const slug of fields){
  const row=fresh.find(r=>r.professions.includes(slug));
  const {steps,preview}=trace(row,{employer:'My unlisted workplace 642',title:'My own role wording',workplaceInfo:null});
  assert.deepEqual(preview.gaps.kinds,['workplace','route'],slug);assert.equal(preview.workplace.sources.length,0);
  assert.equal(steps.at(-1).title,'My own role wording');assert.match(steps.at(-1).detail,/My unlisted workplace 642/);
 }
});
