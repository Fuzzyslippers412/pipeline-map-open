import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import test from 'node:test';
import {matchJobTitle} from '../src/lib/job-match.js';

const catalog=JSON.parse(readFileSync(new URL('../data/professions.json',import.meta.url),'utf8'));
const slugs = title=>matchJobTitle(title,catalog).map(p=>p.slug);

test('whole titles, abbreviations, ranks and specialties resolve to the matching profession',()=>{
  for(const [title,slug] of [['Senior Software Engineer II','software-engineer'],['Senior Full-Stack Developer','software-engineer'],['ICU RN','registered-nurse'],['R.N., B.S.N.','registered-nurse'],['Assistant Professor of Biology','professor'],['Civil Engineer','engineer'],['Master Electrician','electrician'],['Software Engineer — Payments','software-engineer']]){
    assert.deepEqual(slugs(title),[slug],title);
  }
});

test('adjacent occupations cannot inherit a pipeline through a keyword or employer',()=>{
  for(const title of ['Physician Assistant','Pharmacy Technician','Paralegal','Medical Assistant','Engineering Recruiter','Medical Coder','Executive Assistant to the CEO','Amazon','Security Officer','Assistant to the Professor','software engineer recruiter','surgical technician','traveler','constructor','']){
    assert.deepEqual(slugs(title),[],title);
  }
  assert.deepEqual(slugs('Warehouse associate at an engineering company'),[]);
  assert.deepEqual(slugs('RN at a software company'),['registered-nurse']);
});

test('ambiguous and dual titles return distinct choices without an assumed employer',()=>{
  assert.deepEqual(new Set(slugs('Executive Director')),new Set(['nonprofit-executive','corporate-executive']));
  assert.deepEqual(new Set(slugs('Founder & CEO')),new Set(['entrepreneur','corporate-executive','nonprofit-executive']));
  assert.deepEqual(slugs('Registered Nurse / RN'),['registered-nurse']);
  assert.deepEqual(slugs('Pharmacy / Technician'),[]);
});

test('a workplace link belongs to both the named institution and the selected field', async()=>{
  const {findWorkplaceLinks}=await import('../src/lib/trace-context.js');
  const records=JSON.parse(readFileSync(new URL('../data/workplace-links.json',import.meta.url),'utf8'));
  assert.equal(findWorkplaceLinks('Google LLC','software-engineer',records)[0].workplace,'Google');
  assert.equal(findWorkplaceLinks('Google LLC','lawyer',records).length,0);
  assert.equal(findWorkplaceLinks('Not Google LLC','software-engineer',records).length,0);
  assert.equal(findWorkplaceLinks('Howard University Hospital','registered-nurse',records)[0].professions[0],'registered-nurse');
  for(const item of records){
    assert.ok(item.description && item.headline && item.sourceTitle && new URL(item.url).protocol==='https:');
    assert.ok(item.professions.every(slug=>catalog.some(p=>p.slug===slug)));
  }
});
