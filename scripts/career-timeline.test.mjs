import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {buildCareerTimeline} from '../src/lib/career-timeline.js';
const read=name=>JSON.parse(readFileSync(new URL('../data/'+name,import.meta.url)));
const jobs=read('professions.json'),historic={...read('timeline-health-education.json'),...read('timeline-civic-trades.json')};
const reviewers=read('workplace-links.json');
const context={employer:'Howard University Hospital',title:'ICU registered nurse',profession:'registered-nurse'};
const field={slug:context.profession,name:'Registered nurse',historical:historic[context.profession],reviewers,awards:[]};
test('every profession has dated, sourced openings and the hospital succession has its own date',()=>{
 for(const job of jobs){
  for(const entry of historic[job.slug]){
   assert.ok(entry.title&&entry.description&&entry.sourceTitle&&entry.dateLabel&&Number.isInteger(entry.sortYear));
   assert.equal(new URL(entry.url).protocol,'https:');
  }
  assert.ok(historic[job.slug].length>0);
 }
 const rows=buildCareerTimeline({context,field});
 assert.deepEqual(rows.filter(r=>['employer','history'].includes(r.type)).map(r=>r.date),['1892','1901','1941','Fall 1975']);
 assert.match(rows.find(r=>r.date==='Fall 1975').bridge,/Freedmen.*Howard/);
 assert.equal(rows.at(-2).type,'gap');assert.equal(rows.at(-1).type,'self');
});
test('documented funding is chronological, leads cannot fill a gap, retrieval date cannot date a program',()=>{
 const record={title:'A training award',dateBasis:'award',publishedOn:'2024-08-12',indexedOn:'2026-11-03',kind:'documented',mode:'indexed',issuer:context.employer,excerpt:'Funding for a program.',url:'https://example.org/award',publisher:'Example'};
 const unknown={...record,url:'https://example.org/undated',dateBasis:'publication',publishedOn:'2025-01-10'};
 const rows=buildCareerTimeline({context,field:{...field,awards:[record]},report:{results:[{...record,mode:'live'},{...unknown},{...record,kind:'lead',url:'https://example.org/lead'}]}});
 const funds=rows.filter(r=>r.type==='award');
 assert.equal(funds.length,2);assert.equal(funds[0].date,'Aug 12, 2024');assert.equal(funds[1].order,null);assert.match(funds[1].meta,/event date unknown/);
 assert.ok(!rows.some(r=>r.sources.some(s=>s.url.endsWith('/lead'))));
 const unmapped=buildCareerTimeline({context:{...context,profession:''},field:null});
 assert.equal(unmapped[0].type,'gap');assert.equal(unmapped.at(-1).type,'self');
 const related=buildCareerTimeline({context:{...context,related:true},field});
 assert.ok(!related.some(r=>r.type==='employer'));assert.match(related.at(-1).meta,/related field/);
});
