import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import test from 'node:test';
import {suggestJobTitles} from '../src/lib/title-suggestions.js';
import {matchJobTitle} from '../src/lib/job-match.js';
const load=path=>JSON.parse(readFileSync(new URL(path,import.meta.url),'utf8'));
const professions=load('../data/professions.json');
const titles=load('../public/data/job-titles.json');
const suggest=q=>suggestJobTitles(q,professions,titles);

test('job titles autocomplete specialties and aliases before the wider directory is available',()=>{
  const [nurse]=suggestJobTitles('ICU nur',professions);
  assert.equal(nurse.title,'ICU registered nurse');
  assert.equal(nurse.slug,'registered-nurse');
  assert.equal(suggest('swe')[0].title,'SWE');
  assert.ok(suggest('soft eng').some(r=>r.slug==='software-engineer'));
});
test('unreviewed titles can be selected without substituting a neighboring profession',()=>{
  for(const [query,title] of [['pharmacy tech','Pharmacy technician'],['medical assi','Medical assistant'],['clinical research coord','Clinical research coordinator'],['warehouse asso','Warehouse associate']]){
    const match=suggest(query)[0];
    assert.equal(match.title,title);assert.equal(match.slug,null);
    assert.deepEqual(matchJobTitle(match.title,professions),[]);
  }
  assert.equal(suggest('executive director')[0].slug,null);
  assert.equal(suggest('executive director')[0].subtitle,'Several possible professions');
});
test('local results are bounded, deduplicated and do not force an unknown title',()=>{
  assert.deepEqual(suggest('x'),[]);
  assert.deepEqual(suggest('My Unknown Employer-Specific XYZ Title'),[]);
  const res=suggestJobTitles('reg nu',professions,['Registered Nurse','Registered nurse','Registered Nurse Manager'],2);
  assert.equal(res.length,2);
  assert.equal(new Set(res.map(r=>r.title.toLowerCase())).size,res.length);
  assert.ok(titles.length>40000);
});
