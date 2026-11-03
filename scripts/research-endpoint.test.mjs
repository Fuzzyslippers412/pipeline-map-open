import assert from 'node:assert/strict';
import test from 'node:test';
import {handleResearch} from '../worker/research.js';
const url='https://example.test/api/research';
const post=(body,origin='https://example.test')=>new Request(url,{method:'POST',headers:{'Content-Type':'application/json',Origin:origin},body});
test('a valid search returns the classified report without caching private inputs',async()=>{
 const report={status:'complete',results:[],providers:[]};
 const res=await handleResearch(post(JSON.stringify({employer:' Apple ',title:'Aerospace engineer',profession:'engineer'})),async input=>{
  assert.equal(input.employer,'Apple');assert.equal(input.profession,'engineer');return report;
 });
 assert.equal(res.status,200);assert.equal(res.headers.get('Cache-Control'),'no-store');assert.deepEqual(await res.json(),report);
});
test('cross-site, malformed, wrong method and oversized requests cannot start a search',async()=>{
 const reject=()=>assert.fail('provider called');
 for(const [request,status] of [[post('{}','https://other.example'),403],[new Request(url),405],[post('[]'),400],[post('no'),400],[post('x'.repeat(2000)),413]]){
  const res=await handleResearch(request,reject);assert.equal(res.status,status);
 }
});
