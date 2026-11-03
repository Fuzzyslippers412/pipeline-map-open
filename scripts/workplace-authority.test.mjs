import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { findWorkplaceLinks } from '../src/lib/trace-context.js';
import { findWorkplaceAuthority, authorityReadingHref } from '../src/lib/workplace-authority.js';

const rows = JSON.parse(readFileSync(new URL('../data/workplace-links.json', import.meta.url)));

function authority(profession, employer, location, parent) {
  const workplaceInfo = location && { workplace: employer, location, parent };
  const matches = findWorkplaceLinks(employer, profession, rows, workplaceInfo);
  return findWorkplaceAuthority({ profession, employer }, matches);
}

test('same school name requires a reviewed site, city and district', () => {
  const school = 'Booker T. Washington High School';
  assert.equal(authority('k12-teacher', school), null);
  assert.equal(authority('k12-teacher', school, 'Norfolk, VA', 'Norfolk City Public Schools'), null);
  assert.equal(authority('k12-teacher', 'Atlanta Public Schools'), null);
  const record = authority('k12-teacher', school, 'Atlanta, GA', 'Atlanta Public Schools');
  assert.deepEqual(record.entries.map(entry => entry.role), ['School budget and planning', 'Teacher recruitment']);
});

test('a hospital regulator and an apprenticeship program stay attached to the supported employer and profession', () => {
  assert.ok(authority('registered-nurse', 'Howard University Hospital'));
  assert.equal(authority('physician', 'Howard University Hospital'), null);
  assert.equal(authority('registered-nurse', 'Howard University'), null);
  assert.ok(authority('electrician', 'Taylor Electric Company, Chicago, IL'));
  for (const workplace of ['IBEW Local 134', 'Soldier Field, Chicago, IL', 'Unlisted contractor']) {
    assert.equal(authority('electrician', workplace), null);
  }
});


test('the reading shortcut shares only a fixed example or the private in-tab view', () => {
  for (const [profession, employer] of [
    ['registered-nurse', 'Howard University Hospital'],
    ['electrician', 'Taylor Electric Company, Chicago, IL'],
  ]) {
    const record = authority(profession, employer);
    assert.equal(authorityReadingHref(record, true), '/preview/p/' + profession + '/?example=1#who-decides');
    assert.equal(authorityReadingHref(record, false), '/preview/p/' + profession + '/#who-decides');
    assert.equal(authorityReadingHref(authority(profession, 'Example Unlisted Workplace'), false), null);
  }
});
