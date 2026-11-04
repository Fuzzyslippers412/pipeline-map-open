import test from 'node:test';
import assert from 'node:assert/strict';
import {professions,roleFor} from '../src/lib/model.js';
import {historyFor,timelineHistory,dossiers} from '../src/lib/field-history.js';

test('every published field has a sourced history with separately stated consequences and limits',()=>{
 assert.equal(dossiers.length,20);
 for(const p of professions){
  const h=historyFor(p);assert.ok(h.expanded,p.slug);assert.ok(h.events.length>=4,p.slug);
  assert.equal(new Set(h.events.map(e=>e.id)).size,h.events.length,p.slug);
  for(const e of h.events){
   for(const k of ['title','people','decisionMaker','barrier','change','outcome','limit'])assert.ok(typeof e[k]==='string'&&e[k].trim(),p.slug+' '+e.id+' '+k);
   for(const s of [e.source,...(e.sources||[])]){assert.ok(s.locator&&s.type&&s.title);assert.equal(new URL(s.url).protocol,'https:')}
  }
 }
});
test('trace data retains every historical episode, source and limitation',()=>{
 for(const p of professions){
  const h=historyFor(p), timeline=timelineHistory(p);assert.equal(timeline.length,h.events.length);
  for(const e of h.events){const row=timeline.find(r=>r.id===e.id);assert.ok(row.description.includes(e.limit));assert.equal(row.sources.length,1+(e.sources||[]).length)}
 }
});
test('no category pairing is returned as a claim about the reader',()=>{
 for(const p of professions){assert.match(roleFor(p),/not proof/);assert.ok(p.origin.headline&&p.gate.headline&&p.researchQuestion);assert.ok(!p.gate.gatekeeper.includes('university_dei'))}
 assert.ok(!professions.find(p=>p.slug==='corporate-executive').gate.gatekeeper.includes('foundation_nonprofit'));
});
