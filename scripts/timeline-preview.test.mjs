import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {buildCareerTimeline} from '../src/lib/career-timeline.js';
import {buildTimelinePreview,schoolRecordPreview} from '../src/lib/timeline-preview.js';

const load=file=>JSON.parse(readFileSync(new URL('../data/'+file,import.meta.url)));
const history=load('timeline-health-education.json'), reviewers=load('workplace-links.json');
const preview=(context,field,report=null,loadFailed=false)=>{
  const steps=buildCareerTimeline({context,field,report,loadFailed});
  return buildTimelinePreview({steps,context,report,loadFailed});
};

test('earliest field opening and dated employer bridge remain separate, cited records',()=>{
 const context={title:'ICU registered nurse',employer:'Howard University Hospital',profession:'registered-nurse'};
 const field={slug:context.profession,historical:history[context.profession],reviewers,awards:[]};
 const view=preview(context,field);
 assert.equal(view.opening.date,'1892');
 assert.match(view.opening.title,/Tuskegee/);
 assert.equal(view.opening.sources[0].url,history[context.profession][0].url);
 assert.equal(view.workplace.date,'Fall 1975');
 assert.equal(view.workplace.title,'Howard University Hospital replaces Freedmen’s Hospital');
 assert.match(view.workplace.detail,/Freedmen’s Hospital.*ran its own school of nursing/);
 assert.equal(view.workplace.sources.length,2);
 assert.match(view.workplace.sources[0].url,/howard-university-hospital/);
 assert.equal(view.workplace.sources[1].url,'https://medicine.howard.edu/about/history');
 assert.equal(view.gaps.items.length,2);
 assert.equal(view.gaps.title,'2 gaps in the record');
 assert.match(view.gaps.items.join(' '),/personally trained or were hired/);
 assert.equal(view.gaps.detail,'');
});

test('bridge summaries skip unrelated training even at the same workplace',()=>{
 const context={title:'ICU registered nurse',employer:'Howard University Hospital',profession:'registered-nurse'};
 const prior=reviewers.find(row=>row.headline==='The nursing school at Freedmen’s Hospital');
 const bridge=reviewers.find(row=>row.headline==='Howard University Hospital replaces Freedmen’s Hospital');
 const unrelated={...prior,headline:'Another institution established a school',description:'A separate hospital trained nurses.'};
 const field={slug:context.profession,historical:history[context.profession],reviewers:[unrelated,bridge],awards:[]};
 const view=preview(context,field);
 assert.equal(view.workplace.title,bridge.headline);
 assert.equal(view.workplace.detail,'Howard University Hospital opened as the successor to Freedmen’s Hospital.');
 assert.equal(view.workplace.sources.length,1);
 assert.equal(preview({...context,employer:''},field).gaps.title,'1 gap in the record');
});

test('exact-site funding can appear, parent awards and unverified leads cannot',()=>{
 const context={title:'Software engineer',employer:'Exact site',profession:'software-engineer',workplaceInfo:{parent:'Corporate parent'}};
 const award={title:'Training grant',dateBasis:'award',publishedOn:'2024-08-12',dateDetail:'Award date',indexedOn:'2026-11-03',mode:'indexed',kind:'documented',issuer:'Exact site',excerpt:'A grant for training.',url:'https://example.org/site',publisher:'Award register'};
 const parentAward={...award,issuer:'Corporate parent',title:'Parent award',url:'https://example.org/parent'};
 const field={slug:context.profession,historical:history[context.profession],awards:[parentAward,award],reviewers:[]};
 const result=preview(context,field);
 assert.equal(result.workplace.title,'Training grant');
 assert.equal(result.workplace.date,'Aug 12, 2024');
 assert.match(result.workplace.detail,/Workplace funding · Award date · Indexed 2026-11-03/);
 const leadOnly=preview(context,{...field,awards:[parentAward]}, {status:'partial',results:[{...award,kind:'lead'}]});
 assert.deepEqual(leadOnly.workplace.sources,[]);
 assert.match(leadOnly.workplace.detail,/lead/);
});

test('unknown title, related field, employer omitted and load failure retain distinct boundaries',()=>{
 const noField=preview({title:'Bench technician',employer:'Workshop'},null);
 assert.match(noField.opening.title,/No field matched/);
 assert.deepEqual(noField.opening.sources,[]);assert.equal(noField.gaps.items.length,3);
 const failed=preview({title:'Nurse',employer:'Workshop',profession:'registered-nurse'},null,null,true);
 assert.match(failed.opening.detail,/could not be loaded/);
 const noEmployer=preview({title:'Bench technician',employer:''},null);
 assert.match(noEmployer.workplace.title,/No workplace entered/);
 const related=preview({title:'Bench technician',employer:'Howard University Hospital',profession:'registered-nurse',related:true},{slug:'registered-nurse',name:'Registered nurse',historical:history['registered-nurse'],reviewers,awards:[]});
 assert.match(related.opening.detail,/related field/);assert.deepEqual(related.workplace.sources,[]);
});

test('undated reviewed programs are preserved without inventing a start date',()=>{
 const context={title:'Dentist',employer:'Meharry Medical College',profession:'dentist'};
 const view=preview(context,{slug:'dentist',historical:history.dentist,reviewers,awards:[]});
 assert.equal(view.workplace.date,'Start date undocumented');
 assert.equal(view.workplace.sources.length,1);
});

test('teacher edition keeps independently sourced places distinct, including schools with the same name',()=>{
 const field={slug:'k12-teacher',historical:history['k12-teacher'],reviewers,awards:[]};
 const context={title:'Public school teacher',profession:'k12-teacher',employer:'Booker T. Washington High School',workplaceInfo:{
   workplace:'Booker T. Washington High School',parent:'Atlanta Public Schools',location:'Atlanta, GA'
 }};
 const atlanta=schoolRecordPreview(preview(context,field),context);
 assert.equal(atlanta.opening.place,'Marion, Alabama');
 assert.equal(atlanta.workplace.place,'Atlanta, GA');
 assert.match(atlanta.workplace.title,/Charles Lincoln Harper/);
 assert.match(atlanta.workplace.sources[0].url,/#page=7$/);
 assert.match(atlanta.gaps.items.join(' '),/No source here connects the two records/);
 const ambiguous={...context,workplaceInfo:null};
 const unlisted=schoolRecordPreview(preview(ambiguous,field),ambiguous);
 assert.equal(unlisted.workplace.showSearch,true);
 assert.equal(unlisted.workplace.place,undefined);
 assert.match(unlisted.workplace.title,/connecting this history to your school/);
 assert.deepEqual(unlisted.workplace.sources,[]);
 const district={...context,employer:'Atlanta Public Schools',workplaceInfo:null};
 const districtView=schoolRecordPreview(preview(district,field),district);
 assert.equal(districtView.workplace.label,'District record');
 assert.match(districtView.gaps.items[0],/district record/);
});

test('teacher edition preserves failed checks, live leads, and the date basis of funding',()=>{
 const context={title:'Teacher',employer:'Unlisted School',profession:'k12-teacher'};
 const field={slug:context.profession,historical:history['k12-teacher'],reviewers,awards:[]};
 const failed=schoolRecordPreview(preview(context,null,null,true),context,{loadFailed:true});
 assert.match(failed.workplace.title,/unavailable/);
 const report={status:'partial',results:[{kind:'lead'}]};
 const withLead=schoolRecordPreview(preview(context,field,report),context,{report});
 assert.match(withLead.workplace.detail,/research lead/);
 const award={kind:'documented',issuer:context.employer,title:'Local education award',excerpt:'Teacher training funding.',
   dateBasis:'award',publishedOn:'2022',indexedOn:'2026-11-03',dateDetail:'Award year',publisher:'Public award register',url:'https://example.org/award'};
 const funded=schoolRecordPreview(preview(context,{...field,awards:[award]}),context);
 assert.equal(funded.workplace.label,'Workplace funding');
 assert.match(funded.workplace.detail,/Award year · Indexed 2026-11-03/);
 assert.equal(funded.workplace.place,undefined);
});
