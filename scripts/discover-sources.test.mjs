import assert from 'node:assert/strict';
import test from 'node:test';
import { discoverSources,matchIndex } from '../src/lib/discover-sources.js';
const NSF='U.S. National Science Foundation',NEWS='GDELT · recent news';
const school='Example State University';
const input={employer:school,title:'Software engineer',profession:'software-engineer'};
const award={id:'2300111',awardeeName:school,title:'Scholarships in computer science at a historically Black university',abstractText:'The funded program provides computer science scholarships to HBCU students.'};
function mock(awards=[],failed=[]){
 const requests=[];
 return {requests,fetchImpl:async (href,opt)=>{
   const url=new URL(href);requests.push({url,opt});
   if(failed.includes(url.hostname))throw Error('unavailable');
   const data=url.hostname==='api.nsf.gov'?{response:{award:awards}}:
     url.hostname==='api.ies.ed.gov'?{response:{docs:[]}}:
     url.hostname==='api.usaspending.gov'?{results:[]}:
     url.hostname==='api.gdeltproject.org'?{articles:[]}: {resultList:{result:[]}};
   return new Response(JSON.stringify(data),{headers:{'Content-Type':'application/json'}});
 }};
}
test('documented award states a funding relationship and requires the exact recipient and career field',async()=>{
 const fixture=mock([award,{...award,id:'2300112',awardeeName:'Different University'}]);
 const r=await discoverSources({...input,fetchImpl:fixture.fetchImpl});
 assert.equal(r.status,'complete');
 assert.equal(r.counts.live,1);assert.equal(r.results[0].kind,'documented');
 assert.match(r.results[0].excerpt,/listed recipient/);
 for(const {url,opt} of fixture.requests){
  assert.ok(!url.href.toLowerCase().includes('software'));
  assert.ok(!String(opt.body||'').toLowerCase().includes('software'));
  assert.equal(opt.credentials,'omit');assert.equal(opt.referrerPolicy,'no-referrer');
 }
 const mismatch=await discoverSources({...input,title:'Registered nurse',profession:'registered-nurse',fetchImpl:fixture.fetchImpl});
 assert.equal(mismatch.results[0].kind,'lead');
});
test('distinguishes complete empty, partial and unavailable live research',async()=>{
 const blank={...input,employer:'Invented Institution 999-000'};
 assert.equal((await discoverSources({...blank,fetchImpl:mock().fetchImpl})).status,'complete');
 assert.equal((await discoverSources({...blank,fetchImpl:mock([],['api.nsf.gov']).fetchImpl})).status,'partial');
 assert.equal((await discoverSources({...blank,fetchImpl:async()=>{throw Error('offline')}})).status,'unavailable');
 const abort=new AbortController();abort.abort();
 await assert.rejects(discoverSources({...blank,signal:abort.signal,fetchImpl:mock().fetchImpl}),{name:'AbortError'});
});
test('the fallback distinguishes exact grant recipients, name mentions and mismatched roles',()=>{
 const record={publisher:NSF,url:'https://www.nsf.gov/awardsearch/showAward?AWD_ID=2300111',title:award.title,publishedOn:'2021-06-11',issuer:school,awardId:'2300111',fields:['software-engineer'],fundedFields:['software-engineer'],mentions:[]};
 const index={asOf:'2026-11-03',records:[record,{...record,publisher:NEWS,url:'https://news.example/program',title:school+' HBCU scholarship program',issuer:'',fundedFields:[]}]};
 const d=matchIndex(index,input,new Set([NSF,NEWS]));assert.deepEqual(d.map(x=>x.kind),['documented','lead']);
 assert.ok(d.every(x=>x.mode==='indexed'&&x.indexedOn==='2026-11-03'));
 assert.equal(matchIndex(index,{...input,employer:'Unrelated Employer'},new Set([NSF,NEWS])).length,0);
 assert.ok(matchIndex(index,{...input,title:'nurse',profession:'registered-nurse'},new Set([NSF])).every(x=>x.kind==='lead'));
 assert.equal(matchIndex(index,input,new Set([NEWS]))[0].publisher,NEWS);
});
