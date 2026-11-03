import assert from 'node:assert/strict';
import test from 'node:test';
import {readFileSync} from 'node:fs';
import {buildCareerTimeline} from '../src/lib/career-timeline.js';
import {matchJobTitle} from '../src/lib/job-match.js';
import {findWorkplaceLinks} from '../src/lib/trace-context.js';

const load=file=>JSON.parse(readFileSync(new URL('../data/'+file,import.meta.url)));
const reviewed=load('workplace-links.json');
const catalog=load('professions.json');

test('the electrical contractor, union and jobsite have distinct scope and evidence',()=>{
  const matches=name=>findWorkplaceLinks(name,'electrician',reviewed);
  const events=name=>buildCareerTimeline({
    context:{employer:name,title:'Electrical apprentice',profession:'electrician'},
    field:{slug:'electrician',reviewers:reviewed,historical:[],awards:[]},
  }).filter(step=>step.type==='employer');
  for(const [name,scope] of [
    ['Taylor Electric Co., Chicago, IL','contractor'],
    ['IBEW Local 134','union'],
    ['Soldier Field, Chicago','jobsite'],
  ]){
    const [row]=matches(name);
    assert.equal(row.scope,scope,name);
    assert.deepEqual(events(name).map(step=>step.sources[0].url),[row.url],name);
  }
  for(const name of ['Taylor Electric Company','Taylor Electric Company, Utah','Local 134','Soldier Field','Chicago Bears','Unknown Electrical LLC']){
    assert.deepEqual(matches(name),[],name);
  }
  assert.deepEqual(findWorkplaceLinks('IBEW Local 134','engineer',reviewed),[]);
});

test('electrical apprentice and inside wireman titles reach the trades record',()=>{
  for(const title of ['Electrical apprentice','Inside wireman','Journeyman electrician']){
    assert.deepEqual(matchJobTitle(title,catalog).map(match=>match.slug),['electrician']);
  }
  assert.deepEqual(matchJobTitle('Electrical engineering intern',catalog),[]);
});
