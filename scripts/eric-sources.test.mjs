import assert from 'node:assert/strict';
import test from 'node:test';
import {ericSources} from '../src/lib/eric-sources.js';
test('ERIC sends only the employer, returns education research as leads and excludes nearby employers',async()=>{
 let requested;
 const docs=[['ED123','North City Schools created a teacher preparation program for Black teachers.'],['EJ321','Other North City Area Schools created a teacher preparation program for Black teachers.']].map(([id,description])=>({id,title:'Teacher preparation',description}));
 const fetchImpl=async(url,options)=>{requested=new URL(url);assert.equal(options.credentials,'omit');return {ok:true,json:async()=>({response:{docs}})}};
 const found=await ericSources({employer:'North City Schools',title:'Private sample title',profession:'teacher',fetchImpl});
 assert.equal(requested.searchParams.get('search').includes('Private sample title'),false);
 assert.deepEqual(found.map(r=>[r.url,r.kind]),[['https://eric.ed.gov/?id=ED123','lead']]);
});
test('ERIC distinguishes an unavailable index from a completed empty search',async()=>{
 const args={employer:'Q campus',title:'teacher'};
 await assert.rejects(ericSources({...args,fetchImpl:async()=>({ok:false})}),/unavailable/);
 assert.deepEqual(await ericSources({...args,fetchImpl:async()=>({ok:true,json:async()=>({response:{docs:[]}})})}),[]);
});

test('recent news is a lead only and an unrelated article domain cannot be substituted',async()=>{
 const {newsSources}=await import('../src/lib/news-sources.js');
 const rows=[
   {title:'Example Tech launches an HBCU internship program',url:'https://example.test/news',domain:'example.test'},
   {title:'Example Tech launches an HBCU internship program',url:'https://elsewhere.test/article',domain:'example.test'},
   {title:'Other Company launches an HBCU internship program',url:'https://example.test/other',domain:'example.test'}];
 const data=await newsSources({employer:'Example Tech',title:'Confidential title',fetchImpl:async url=>{
   assert.ok(!url.includes('Confidential'));return {ok:true,json:async()=>({articles:rows})};
 }});
 assert.deepEqual(data.map(r=>[r.url,r.kind]),[['https://example.test/news','lead']]);
});
test('health research requires the employer in the title or abstract and the appropriate field',async()=>{
 const {europePmcSources}=await import('../src/lib/europe-pmc-sources.js');
 const results=[{source:'MED',id:'123',title:'Medical education pathways',abstractText:'Example Hospital supported mentorship for Black physicians in its residency program.'},
   {source:'MED',id:'456',title:'Clinical treatment',abstractText:'People in Example Hospital received routine care.'}];
 const data=await europePmcSources({employer:'Example Hospital',title:'radiologist',profession:'physician',fetchImpl:async url=>{
   assert.ok(!url.includes('radiologist'));return {ok:true,json:async()=>({resultList:{result:results}})};
 }});
 assert.deepEqual(data.map(r=>r.url),['https://europepmc.org/article/MED/123']);
});

test('an official federal funding link requires an exact recipient and a field-specific program',async()=>{
 const {usaSpendingSources}=await import('../src/lib/usa-spending-sources.js');
 const row={'Recipient Name':'Example College','Description':'Nursing training for Black students at an HBCU.','Start Date':'2024-08-01','Award ID':'123','generated_internal_id':'ASST_NON_123_049'};
 const data=await usaSpendingSources({employer:'Example College',title:'Private sample role',profession:'registered-nurse',fetchImpl:async(_,opts)=>{
  assert.ok(!opts.body.includes('Private sample role'));return {ok:true,json:async()=>({results:[row,{...row,'Recipient Name':'Example College Foundation'}]})};
 }});
 assert.deepEqual(data.map(v=>[v.url,v.kind]),[['https://www.usaspending.gov/award/ASST_NON_123_049','documented']]);
});
