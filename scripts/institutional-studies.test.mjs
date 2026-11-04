import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {validateStudy} from '../src/lib/validate-study.js';
import {discoveryRecords,filterDiscovery,validMode,sections} from '../src/lib/institutional-studies.js';
const study=JSON.parse(readFileSync(new URL('../data/institutions/medicine.json',import.meta.url)));
test('medicine has seven sourced research sections with both countries and consistent reading depths',()=>{
 assert.deepEqual(validateStudy(study),[]);assert.equal(sections.length,7);
 assert.ok(study.claims.some(c=>c.country==='global'));assert.ok(study.claims.some(c=>c.status==='interpretation'));
 assert.equal(study.comparison.length,8);assert.equal(study.sources.length,34);
});
test('a missing source, collapsed country, invalid date or unlinked teaching answer fails validation',()=>{
 const broken=structuredClone(study);broken.claims[0].sourceIds=['not-a-source'];broken.comparison[0].cm.text='';broken.sources[0].publishedOn='today';broken.questions[0].claimId='invented';
 const errors=validateStudy(broken).join(' ');assert.match(errors,/unknown source/);assert.match(errors,/Missing comparison/);assert.match(errors,/publication date/);assert.match(errors,/Unlinked learning/);
});
test('current, dated and causal limits survive the institutional dataset',()=>{
 const get=id=>study.claims.find(c=>c.id===id);
 assert.match(get('cm-household-financing').period,/2018–2019/);assert.match(get('cm-household-financing').limit,/not a 2026/);
 assert.match(get('cm-national-entry').limit,/date has passed/);assert.match(get('cm-public-building').limit,/not proof of disbursement/);
 assert.match(get('us-ownership-state-rules').limit,/California example only/);assert.match(get('hist-meharry-funding-1876').limit,/pledge is not an audited receipt/i);
 assert.match(get('hist-howard-federal-authorization-1928').limit,/does not establish a medical-school payment/);
 assert.ok(study.researchGaps.some(g=>/transaction|payment|proceeds/.test(g)));
});
test('discovery keeps all original careers and exposes Cameroon only where research exists',()=>{
 const records=discoveryRecords();assert.equal(records.length,22);assert.equal(records.filter(r=>r.study).length,1);
 assert.deepEqual(filterDiscovery(records,{country:'cm'}).map(r=>r.slug),['physician']);
 assert.equal(filterDiscovery(records,{country:'cm',sector:'Education'}).length,0);
 assert.equal(filterDiscovery(records,{query:'not-a-career-937'}).length,0);
 assert.equal(filterDiscovery(records,{}).length,22);
 for(const id of ['registered-nurse','k12-teacher','pharmacist'])assert.ok(records.some(r=>r.slug===id));
});
test('discovery filters describe existing records rather than inventing required qualifications or dates',()=>{
 const records=discoveryRecords();
 for(const r of filterDiscovery(records,{education:'credential'}))assert.ok(r.credential);
 for(const r of filterDiscovery(records,{period:'before1900'}))assert.ok(r.years.some(y=>y<1900));
 for(const r of filterDiscovery(records,{institution:'health',ownership:'on'})){assert.ok(r.institutions.includes('health'));assert.equal(r.ownership,true)}
 assert.equal(validMode('young'),'young');assert.equal(validMode('teen'),'teen');assert.equal(validMode('unknown'),'adult');
});
