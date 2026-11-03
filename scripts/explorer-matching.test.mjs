import test from 'node:test';
import assert from 'node:assert/strict';
import {exploreActivities,activities} from '../src/lib/explorer-matching.js';
import {explorerRecords} from '../src/lib/explorer-records.js';

test('a practical and an exploratory choice surface two different tasks with a truthful reason', () => {
  const picks = exploreActivities(explorerRecords,['fix'],['explain']);
  assert.deepEqual(picks.slice(0,2).map(record=>record.id),['computer-support','technical-writing']);
  assert.match(picks[0].why,/already help with fixing things.*want to try explaining/);
  assert.ok(picks.length>=2 && picks.length<=3);
});

test('a student can skip both prompts or skip strengths and choose new interests', () => {
  const sample = exploreActivities(explorerRecords);
  assert.equal(sample.length,3);
  assert.equal(new Set(sample.map(record=>record.id)).size,3);
  assert.ok(sample.every(record=>record.why.includes('sample')));
  const curious = exploreActivities(explorerRecords,[],['care']);
  assert.ok(curious.every(record=>!record.why.includes('already')));
  assert.ok(curious.some(record=>record.id==='registered-nurse'));
  for(const {id} of activities) {
    const paths=exploreActivities(explorerRecords,[id]);
    assert.ok(paths.length>=2 && paths.length<=3,id);
    assert.equal(new Set(paths.map(record=>record.id)).size,paths.length);
  }
});
