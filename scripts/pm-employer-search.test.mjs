import test from 'node:test';
import assert from 'node:assert/strict';
import {pmBoardSources,reviewedPmSources,describePmRecord,safeRecordUrl} from '../src/lib/pm-employer-sources.js';
import {discoverSources} from '../src/lib/discover-sources.js';
import {handleResearch} from '../worker/research.js';

const employer='Acme Labs',role='product-manager';
const listing={internal_job_id:4,company_name:employer,title:'Senior Product Manager',absolute_url:'https://jobs.example.test/product',location:{name:'NYC'}};
const json=data=>new Response(JSON.stringify(data),{headers:{'content-type':'application/json'}});
function fixture({boardName=employer,jobs=[],down=false}={}){
  const requests=[];
  const fetchImpl=async(href,options)=>{
    const url=new URL(href);requests.push({url,options});
    if(down)throw Error('offline');
    switch(url.hostname){
      case 'boards-api.greenhouse.io':return json(url.pathname.endsWith('/jobs')?{jobs}:{name:boardName});
      case 'api.ies.ed.gov':return json({response:{docs:[]}});
      case 'api.usaspending.gov':return json({results:[]});
      case 'api.nsf.gov':return json({response:{award:[]}});
      case 'api.gdeltproject.org':return json({articles:[]});
      default:throw Error('unexpected request');
    }
  };
  return {requests,fetchImpl};
}
test('a board must identify the employer, each posting must match the same employer and the selected role',async()=>{
  const f=fixture({jobs:[listing,{...listing,title:'Program Manager'},{...listing,title:'Recruiter, Product Management'},
    {...listing,company_name:'Acme Labs West'},{...listing,absolute_url:'http://unsafe.test/x'},{...listing,internal_job_id:null}]});
  const rows=await pmBoardSources({employer,profession:role,fetchImpl:f.fetchImpl});
  assert.equal(rows.length,1);assert.equal(rows[0].scope,'role');assert.match(rows[0].limit,/does not say who/);
  assert.equal(safeRecordUrl('https://secret@host.test'),null);
  const mismatch=fixture({boardName:'Acme Laboratories',jobs:[listing]});
  assert.deepEqual(await pmBoardSources({employer,profession:role,fetchImpl:mismatch.fetchImpl}),[]);
  assert.equal(mismatch.requests.length,1);
});
test('reviewed history, published hiring procedures, role switching and subsidiary boundaries',()=>{
  const amazon=(r)=>reviewedPmSources('Amazon, Inc.',r);
  assert.equal(amazon(role)[0].scope,'history');assert.match(amazon(role)[0].connection,/Howard/);
  assert.equal(amazon('program-manager')[0].scope,'role');assert.equal(amazon('project-manager').length,0);
  assert.deepEqual(reviewedPmSources('Amazon Warehouse',role),[]);
  assert.deepEqual(reviewedPmSources('NASA','program-manager'),[]);
  assert.match(reviewedPmSources('NASA Langley','program-manager')[0].connection,/Jackson/);
  assert.match(reviewedPmSources('Jet Propulsion Laboratory','project-manager')[0].title,/Hunt/);
  assert.equal(describePmRecord({kind:'documented',excerpt:'Awarded funding.'}).scope,'funding');
  assert.equal(describePmRecord({kind:'lead',excerpt:'An education paper.'}).scope,'lead');
});
test('the real endpoint resolves an unlisted employer; a posting stays distinct from access history',async()=>{
  const f=fixture({jobs:[listing]});
  const res=await handleResearch(new Request('https://local.test/api/research',{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify({employer,title:'PM',profession:role})}),args=>discoverSources({...args,fetchImpl:f.fetchImpl}));
  const report=await res.json();assert.equal(res.status,200);assert.equal(report.results[0].scope,'role');assert.equal(report.results[0].mode,'live');
  assert.deepEqual(report.counts,{live:1,indexed:0,reviewed:0});
  for(const {url,options} of f.requests)assert.doesNotMatch(url.href+' '+(options.body||''),/product.manager/i);
  // Selecting Program instead must not return Product.
  const program=await discoverSources({employer,title:'PM',profession:'program-manager',fetchImpl:f.fetchImpl});
  assert.deepEqual(program.results,[]);assert.equal(program.status,'complete');
});
test('publisher outages retain reviewed evidence without calling it live; unknown employers remain open',async()=>{
  const f=fixture({down:true});
  const r=await discoverSources({employer:'Amazon',title:'PM',profession:role,fetchImpl:f.fetchImpl});
  assert.equal(r.status,'unavailable');assert.equal(r.results[0].mode,'reviewed');assert.equal(r.counts.live,0);
  const unknown=await discoverSources({employer:'Unlisted Village 84',title:'PM',profession:role,fetchImpl:f.fetchImpl});
  assert.equal(unknown.status,'unavailable');assert.deepEqual(unknown.results,[]);
});
