import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {findWorkplaceLinks,saveTrace,readTrace} from '../src/lib/trace-context.js';
import {buildCareerTimeline} from '../src/lib/career-timeline.js';
import {buildTimelinePreview,paperRecordPreview} from '../src/lib/timeline-preview.js';
import {resolveTitle} from '../src/lib/title-resolver.js';
import {computingWorkplaceRecord} from '../src/lib/computing-context.js';
import {GET} from '../src/pages/data/workplaces/[part].json.js';
import {WorkplaceSearch} from '../src/lib/workplace-search.js';
import {professions} from '../src/lib/model.js';
import {timelineHistory,historyFor} from '../src/lib/field-history.js';
const rows=JSON.parse(readFileSync(new URL('../data/workplace-links.json',import.meta.url)));
function trace(row,context={}){
 const slug=row.professions[0],p=professions.find(p=>p.slug===slug);
 const c={employer:row.workplace,title:p.name,profession:slug,workplaceInfo:{workplace:row.workplace,id:row.site.id},...context};
 const steps=buildCareerTimeline({context:c,field:{slug,name:p.name,historical:timelineHistory(p),reviewers:rows}});
 return {steps,context:c,preview:buildTimelinePreview({steps,context:c})};
}
test('new workplace histories connect only the documented site and retain the personal-route gap',()=>{
 const fresh=rows.filter(r=>r.reviewedOn==='2026-11-04'&&r.historyEventId);
 assert.equal(fresh.length,9);
 for(const row of fresh){
  const options=row.contextKeys?{contextKey:row.contextKeys[0],related:true}:{};
  const {steps,preview}=trace(row,options);
  assert.ok(steps.some(r=>r.type==='employer'&&r.connectsHistory),row.workplace);
  assert.ok(steps.some(r=>r.type==='gap'&&r.title==='Your route into this job'),row.workplace);
  assert.deepEqual(preview.gaps.kinds,['route'],row.workplace);
  assert.equal(preview.workplace.connectsHistory,true,row.workplace);
  assert.ok(preview.opening.sources.length,row.workplace);
  const wrong={workplace:row.workplace,id:'a-different-worksite'};
  assert.deepEqual(findWorkplaceLinks(row.workplace,row.professions[0],[row],wrong,options),[],row.workplace);
  assert.ok(row.sourceNote&&row.historyEventId);
 }
});
test('Kaiser Oakland does not inherit the combined Oakland/Richmond identifier or the health-system parent',()=>{
 for(const employer of ['Kaiser Permanente','Kaiser Richmond','Kaiser Permanente San Francisco Medical Center']){
  assert.deepEqual(findWorkplaceLinks(employer,'registered-nurse',rows),[]);
 }
 const employer='Kaiser Foundation Hospital - Oakland/Richmond';
 assert.deepEqual(findWorkplaceLinks(employer,'registered-nurse',rows,{workplace:employer,id:'cms-hospital-050075'}),[]);
});
test('SRE requires the selected reliability duties, survives storage and excludes unrelated Google records',()=>{
 const result=resolveTitle('SRE',professions).choices.find(c=>c.label==='Keeping software services reliable').result;
 assert.equal(result.contextKey,'sre');
 assert.ok(computingWorkplaceRecord({employer:'Google',contextKey:'sre'}));
 assert.equal(computingWorkplaceRecord({employer:'Another company',contextKey:'sre'}),null);
 assert.equal(computingWorkplaceRecord({employer:'Google',contextKey:'security'}),null);
 const row=rows.find(r=>r.historyEventId==='croak-google-reliability-2020');
 const store=new Map();globalThis.window={sessionStorage:{getItem:k=>store.get(k),setItem:(k,v)=>store.set(k,v)}};
 try{
  saveTrace({title:'my SRE title',workplace:'Google',workplaceInfo:{workplace:'Google',id:'verified-google'},slug:'software-engineer',match:'related',contextKey:result.contextKey});
  assert.equal(readTrace().contextKey,'sre');assert.equal(readTrace().title,'my SRE title');
 }finally{delete globalThis.window}
 const {steps,preview}=trace(row,{contextKey:result.contextKey,related:true});
 assert.equal(steps.filter(s=>s.type==='employer').length,1);
 assert.match(preview.opening.title,/Croak/);assert.match(preview.workplace.title,/reliability/);
 for(const contextKey of ['', 'devops','security','support','software']){
  assert.deepEqual(findWorkplaceLinks('Google','software-engineer',rows,{workplace:'Google',id:'verified-google'},{related:true,contextKey}),[]);
 }
 assert.deepEqual(findWorkplaceLinks('Alphabet Inc.','software-engineer',rows,{workplace:'Alphabet Inc.',id:'sec-1652044'},{related:true,contextKey:'sre'}),[]);
});
test('selected Baldwin school has a sourced historical connection while another same-name school retains a gap',()=>{
 const row=rows.find(r=>r.historyEventId==='teacher-baldwin-agassiz-1889');
 const {steps,context,preview}=trace(row);
 assert.match(preview.opening.title,/Baldwin/);
 const paper=paperRecordPreview(preview,context);
 assert.deepEqual(paper.gaps.kinds,['route']);assert.match(paper.workplace.sourceNote,/different buildings/);
 const other=trace(row,{workplaceInfo:{workplace:row.workplace,id:'another-baldwin-school'}});
 assert.ok(other.preview.gaps.kinds.includes('workplace'));assert.equal(other.preview.workplace.sources.length,0);
});
test('reviewed exact workplaces and their historical aliases remain searchable with stable IDs',async()=>{
 const index=new WorkplaceSearch();
 for(const part of ['main','schools'])index.add(await GET({params:{part}}).json());
 for(const [q,id] of [['Kaiser Oakland','reviewed-kaiser-oakland'],['Provident Hospital of Cook County Chicago','cms-hospital-140300'],['NASA Lewis Research Center Cleveland OH','reviewed-nasa-glenn'],['Agassiz School Cambridge MA','nces-school-250327000435'],['MIT','ipeds-166683']]){
  const result=index.search(q);assert.equal(result[0]?.id,id,q);assert.ok(result[0]?.sourceUrl,q);
 }
});
test('an unlisted workplace retains a workplace gap despite expanded field coverage',()=>{
 for(const slug of ['registered-nurse','k12-teacher','software-engineer']){
  const p=professions.find(p=>p.slug===slug),context={employer:'My unlisted workplace 319',title:'My own title',profession:slug};
  const steps=buildCareerTimeline({context,field:{slug,name:p.name,historical:timelineHistory(p),reviewers:rows}});
  const preview=buildTimelinePreview({steps,context});
  assert.deepEqual(preview.gaps.kinds,['workplace','route']);assert.equal(preview.workplace.sources.length,0);
  assert.equal(steps.at(-1).title,'My own title');assert.match(steps.at(-1).detail,/My unlisted workplace 319/);
  assert.ok(historyFor(p).researchLeads.every(r=>r.status));
 }
});
