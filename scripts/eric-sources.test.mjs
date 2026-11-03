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
