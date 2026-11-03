import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import test from 'node:test';
import {prepareNomination} from '../src/lib/workplace-nomination.js';

const sample = {site:'St. Mary’s & West',city:'St. Louis',state:'MO',profession:'Nurse / educator'};
const template = readFileSync(new URL('../.github/ISSUE_TEMPLATE/workplace.yml', import.meta.url), 'utf8');

test('nomination round-trips the exact public fields through the tracker form', () => {
  const source = 'https://example.org/records?unit=10&branch=8#notes';
  const result = prepareNomination({...sample, source, privateName:'private detail', parent:'unrequested affiliation'});
  const url = new URL(result.github);
  assert.equal(url.origin + url.pathname, 'https://github.com/Fuzzyslippers412/pipeline-map-corrections/issues/new');
  assert.equal(url.searchParams.get('template'), 'workplace.yml');
  for (const [key,value] of Object.entries({...sample,source})) {
    assert.match(template, new RegExp('^    id: ' + key + '$','m'));
    assert.equal(url.searchParams.get(key), value);
    assert.ok(result.summary.includes(value));
  }
  assert.doesNotMatch(result.summary + url.href, /private detail|unrequested affiliation/);
});

test('a reader may nominate an unknown workplace without a source', () => {
  const result = prepareNomination({...sample,site:'  Neighborhood Library  '});
  assert.equal(new URL(result.github).searchParams.get('site'), 'Neighborhood Library');
  assert.equal(new URL(result.github).searchParams.has('source'), false);
  assert.doesNotMatch(result.summary, /Public source:/);
  assert.doesNotMatch(template.split(/^    id: source$/m)[1], /required: true/);
});

test('empty public fields and nonpublic link formats cannot open a draft', () => {
  for (const field of ['site','city','state','profession']) {
    assert.deepEqual(prepareNomination({...sample,[field]:'   '}),{error:field});
  }
  for (const source of ['javascript:alert(1)','file:///Users/sample/private','https://person:password@example.org/','bad url']) {
    assert.deepEqual(prepareNomination({...sample,source}),{error:'source'});
  }
});
