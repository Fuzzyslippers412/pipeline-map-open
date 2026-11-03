import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import test from 'node:test';
import {resolveTitle} from '../src/lib/title-resolver.js';
import {suggestJobTitles} from '../src/lib/title-suggestions.js';

const load = path => JSON.parse(readFileSync(new URL(path,import.meta.url),'utf8'));
const catalog = load('../data/professions.json');
const directory = load('../public/data/job-occupations.json');

test('tester inputs keep their meaning on submit and when a suggestion is selected, online or offline', () => {
  const cases = [
    ['devops eng','related','DevOps Engineer'],
    ['Site Reliability engineer','choices','Site Reliability Engineer'],
    ['system admin','choices','Systems Administrator'],
    ['sysadmin','choices','Systems Administrator'],
    ['Sr SRE II','choices','Sr SRE II'],
    ['IT help desk','recognized','IT Support Specialist'],
    ['SRE','choices','SRE'],
    ['regular IT','choices','IT'],
    ['IT','choices','IT'],
    ['software Eng','exact','Software engineer'],
    ['security engineer','choices','Security Engineer'],
  ];
  for (const data of [undefined,directory]) {
    for (const [input,kind,suggestion] of cases) {
      const result = resolveTitle(input,catalog,data);
      assert.equal(result.kind,kind,input);
      assert.equal(result.title,input);
      const top = suggestJobTitles(input,catalog,data)[0];
      assert.equal(top.title,suggestion,input);
      const picked = resolveTitle(top.title,catalog,data);
      assert.equal(picked.kind,result.kind);
      assert.equal(picked.slug,result.slug);
      if (kind==='choices') {
        assert.deepEqual(picked.choices.map(choice=>choice.label),result.choices.map(choice=>choice.label));
        assert.ok(result.choices.every(choice=>choice.result.title===input));
      }
    }
    assert.ok(suggestJobTitles('IT',catalog,data).every(row=>row.title.match(/\bIT\b/i)));
  }
});

test('reported, alternate and short title provenance survives deduplication across occupation codes', () => {
  const row = directory.entries.find(entry=>entry[0]==='Site Reliability Engineer');
  const codes = [];
  for(let i=1;i<row.length;i+=2) {
    codes.push(directory.occupations[row[i]][0]);
    assert.ok(directory.origins[row[i+1]].some(label=>label.startsWith('alternate:')));
  }
  assert.deepEqual(codes.sort(),['15-1221.00','15-1252.00','17-2112.02']);
  const sre=directory.entries.find(entry=>entry[0]==='SRE');
  assert.equal(directory.occupations[sre[1]][0],'15-1252.00');
  assert.ok(directory.origins[sre[2]].some(label=>label.startsWith('short:')));
  const recognition=resolveTitle('Medical Assistant',catalog,directory);
  assert.equal(recognition.kind,'recognized');
  assert.equal(recognition.occupations[0].code,'31-9092.00');
  assert.equal(recognition.slug,undefined);
});

test('ambiguous technical and physical roles do not silently inherit software or a computing workplace', () => {
  for(const title of ['SRE','security engineer','system admin']) {
    assert.equal(resolveTitle(title,catalog,directory).slug,undefined);
  }
  const responses = resolveTitle('security engineer',catalog,directory).choices.map(c=>c.result);
  assert.equal(responses.find(r=>r.occupation==='Physical security').computing,undefined);
  assert.equal(responses.find(r=>r.occupation==='Information security engineering').contextKey,'security');
  assert.equal(resolveTitle('software engineer recruiter',catalog,directory).kind,'unknown');
  for(const title of ['ICU RN','Electrician','Software engineer']) {
    assert.equal(resolveTitle(title,catalog,directory).kind,'exact');
  }
  assert.equal(resolveTitle('unknown reader title 793',catalog,directory).kind,'unknown');
});

test('matches a catalog title containing “at” while accepting a role followed by an employer', () => {
  const sergeant = resolveTitle('Sergeant at Arms',catalog,directory);
  assert.equal(sergeant.kind,'recognized');
  assert.ok(sergeant.occupations.length);
  assert.equal(resolveTitle('Software engineer at Example Foods',catalog,directory).slug,'software-engineer');
});
