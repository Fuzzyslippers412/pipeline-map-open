import test from 'node:test';
import assert from 'node:assert/strict';
import {pmPathStory,workplaceStep,evidenceLabel,pmResearchStatus} from '../src/lib/pm-path-model.js';
import {reviewedPmSources,pmBoardCheck} from '../src/lib/pm-employer-sources.js';
import {cleanSuggestionDraft,saveSuggestionDraft,takeSuggestionDraft} from '../src/lib/nomination-draft.js';

test('an employer profile cannot close the link from a different initiative to the reader',()=>{
  const role='product-manager',story=pmPathStory(role),record=reviewedPmSources('Amazon',role)[0];
  assert.equal(story.person,'Kayiita Johnson');
  assert.match(evidenceLabel(record),/professional’s role/);
  const step=workplaceStep(role,'Amazon');
  assert.equal(step.record.title,'Angelina Howard at Amazon');assert.equal(step.link,'open');
  assert.match(step.description,/separate workplace record/);
  assert.match(step.description,/still open/);
  assert.equal(workplaceStep(role,'Amazon Warehouse').record,null);
});
test('a matching historical workplace still leaves personal hiring unproved; programs and products stay distinct',()=>{
  const step=workplaceStep('program-manager','NASA Langley');
  assert.match(step.description,/historical workplace/);assert.match(step.description,/appointment still needs/);
  assert.equal(evidenceLabel(step.record),'Black access documented');assert.equal(step.link,'open');
  assert.equal(workplaceStep('product-manager','NASA Langley').record,null);
  assert.equal(workplaceStep('program-manager','NASA').record,null);
  assert.equal(workplaceStep('program-manager','').label,'Workplace not entered');
  assert.equal(workplaceStep('program-manager','Hospital 84').label,'Still open at Hospital 84');
});
test('job postings and institutional awards stay separate from Black access evidence',()=>{
  const posting={scope:'role',evidence:'posting',title:'Product manager',url:'https://example.test/job'};
  const step=workplaceStep('product-manager','Acme',undefined,[posting]);
  assert.equal(evidenceLabel(posting),'Role advertised');assert.match(step.description,/Who opened access.*still open/);assert.equal(step.link,'open');
  assert.equal(evidenceLabel({scope:'role',evidence:'process'}),'Hiring process described');
  assert.equal(evidenceLabel({scope:'funding'}),'Institutional funding documented');
  assert.equal(evidenceLabel({scope:'lead'}),'Lead to investigate');
  // A loose or unknown field from an external record cannot upgrade a lead.
  assert.equal(evidenceLabel({scope:'lead',evidence:'access'}),'Lead to investigate');
});
test('project sectors change the actual example and research question without inventing a credential or title',()=>{
  const general=pmPathStory('project-manager'),community=pmPathStory('project-manager','community');
  assert.equal(general.person,'Asya Watkins');assert.equal(general.evidence,'access');
  assert.equal(community.person,'Bayard Rustin');assert.match(community.comparison,/deputy director/);
  assert.equal(community.evidence,'professional');assert.match(community.question,/Who appointed/);assert.match(community.next,/planning committee/);
  const health=pmPathStory('project-manager','health');assert.equal(health.person,'Asya Watkins');
  assert.match(health.comparison,/sector needs evidence/);assert.match(health.question,/hospital/);assert.match(health.next,/project charter/);
  const hunt=workplaceStep('project-manager','JPL','engineering');
  assert.match(hunt.description,/historical workplace/);assert.equal(hunt.link,'open');
});
test('search status distinguishes outages, unsupported employer identity and no relevant record',()=>{
  const status=(report,matches=[])=>pmResearchStatus(report,'Acme',matches);
  assert.match(status({status:'unavailable',providers:[{status:'unavailable'}]}),/could not finish/);
  assert.match(status({status:'complete',providers:[]}),/exact workplace/);
  assert.match(status({status:'complete',providers:[{status:'ok',coverage:'not-found'}]}),/No matching job board/);
  assert.match(status({status:'complete',providers:[{status:'ok',coverage:'identity-mismatch'}]}),/did not match/);
  assert.match(status({status:'partial',providers:[{status:'ok',coverage:'no-role'}]}),/Some publishers could not be checked/);
  assert.match(status({status:'complete',providers:[{status:'ok'}]},[{scope:'role'}]),/access story is still open/);
});
test('board coverage distinguishes identity failure from an empty role search',async()=>{
  const input={employer:'Acme',profession:'program-manager'};
  const noBoard=await pmBoardCheck({...input,fetchImpl:async()=>new Response('',{status:404})});
  assert.equal(noBoard.coverage,'not-found');
  const mismatch=await pmBoardCheck({...input,fetchImpl:async()=>Response.json({name:'Acme West'})});
  assert.equal(mismatch.coverage,'identity-mismatch');
  const noRole=await pmBoardCheck({...input,fetchImpl:async url=>Response.json(url.endsWith('/jobs')?{jobs:[]}:{name:'Acme'})});
  assert.equal(noRole.coverage,'no-role');assert.deepEqual(noRole.results,[]);
});
test('source suggestion handoff is tab-local, consumed once and contains only reviewable draft fields',()=>{
  const memory=new Map();
  globalThis.sessionStorage={setItem:(k,v)=>memory.set(k,v),getItem:k=>memory.get(k)??null,removeItem:k=>memory.delete(k)};
  try{
    const draft={site:' Example School ',profession:'Program manager',privateName:'private',source:'unreviewed'};
    assert.deepEqual(cleanSuggestionDraft(draft),{site:'Example School',profession:'Program manager'});
    saveSuggestionDraft(draft);
    assert.deepEqual(takeSuggestionDraft(),{site:'Example School',profession:'Program manager'});
    assert.equal(takeSuggestionDraft(),null);assert.equal(memory.size,0);
    assert.equal(cleanSuggestionDraft(null),null);
  }finally{delete globalThis.sessionStorage}
});
