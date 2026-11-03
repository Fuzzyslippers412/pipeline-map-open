import assert from 'node:assert/strict';
import test from 'node:test';
import { discoverSources } from '../src/lib/discover-sources.js';

const employer='Example Systems';
const input={employer,title:'Senior software engineer',profession:'software-engineer'};
const article=(title,content,url='https://tmcf.org/intern-program/')=>({title:{rendered:title},link:url,content:{rendered:content}});
function mockFetch(records=[],failed=[]) {
  const requests=[];
  const fetchImpl=async (href,options)=>{
    const url=new URL(href); requests.push({url,options});
    if(failed.includes(url.hostname))throw Error('Provider offline');
    let data=[];
    if(url.hostname==='api.ies.ed.gov')data={response:{docs:[]}};
    else if(url.hostname==='tmcf.org' && url.pathname.endsWith('/posts'))data=records;
    return new Response(JSON.stringify(data),{headers:{'content-type':'application/json'}});
  };
  return {requests,fetchImpl};
}

test('uses actual article evidence; refuses loose mentions, biographies and unsafe URLs',async()=>{
  const {requests,fetchImpl}=mockFetch([
    article('Example Systems HBCU internship program','<p>Example Systems launched software engineering internships for HBCU students in 2018.</p>'),
    article('Community partners','<p>Example Systems supported an HBCU scholarship program for business graduates.</p>','https://tmcf.org/scholarship/'),
    article('Industry news','<p>Example Systems made a donation to the local food pantry.</p><p>Other companies launched computer science internships for HBCU students.</p>','https://tmcf.org/different-program/'),
    article('Profiles','<p>Example Systems launched software engineering internships for HBCU students.</p>','https://unrelated.test/article'),
    article('Scholar who discovered a career','<p>Example Systems launched software engineering internships for HBCU students.</p>','https://tmcf.org/profile/')
  ]);
  const result=await discoverSources({...input,fetchImpl});
  assert.equal(result.status,'complete');
  assert.deepEqual(result.results.map(r=>[r.url,r.kind]),[['https://tmcf.org/intern-program/','documented'],['https://tmcf.org/scholarship/','lead']]);
  for(const {url,options} of requests) {
    assert.ok(!url.href.toLowerCase().includes('software'));
    assert.ok(!url.href.toLowerCase().includes('senior'));
    assert.ok(!url.href.toLowerCase().includes('engineer') || url.hostname==='nsbe.org');
    assert.equal(options.credentials,'omit');
    assert.equal(options.referrerPolicy,'no-referrer');
  }
});

test('wrong institution and isolated words from separate paragraphs are insufficient',async()=>{
  const {fetchImpl}=mockFetch([
    article('Opportunity at Another Employer','<p>Another employer launched an HBCU software internship.</p>'),
    article('Example Systems is an event supporter','<p>Example Systems donated lunch to a gathering.</p><p>A different employer offers HBCU software engineering internships.</p>'),
  ]);
  const d=await discoverSources({...input,fetchImpl});
  assert.deepEqual(d.results,[]);
  assert.equal(d.status,'complete');
});

test('labels provider outage independently of an empty research result',async()=>{
  const one=mockFetch([],['tmcf.org']);
  const partial=await discoverSources({...input,fetchImpl:one.fetchImpl});
  assert.equal(partial.status,'partial');
  assert.ok(partial.providers.find(p=>p.name==='Thurgood Marshall College Fund'&&p.status==='unavailable'));
  const unavailable=await discoverSources({...input,fetchImpl:async()=>{throw Error('offline')}});
  assert.equal(unavailable.status,'unavailable');
  const abort=new AbortController();abort.abort();
  await assert.rejects(discoverSources({...input,signal:abort.signal,fetchImpl:one.fetchImpl}),{name:'AbortError'});
});

test('honors an arbitrary job title locally rather than assigning a seeded profession',async()=>{
  const {fetchImpl}=mockFetch([article('Example Systems HBCU scholarship','<p>Example Systems sponsored an HBCU scholarship for supply chain analysts.</p>')]);
  const d=await discoverSources({...input,title:'supply chain analyst',profession:'',fetchImpl});
  assert.equal(d.results[0].kind,'documented');
  const different=await discoverSources({...input,title:'supply chain manager',profession:'',fetchImpl});
  assert.equal(different.results[0].kind,'lead');
  const exact=mockFetch([article('Example Systems HBCU internship','<p>Example Systems sponsored an HBCU internship, including a supply chain analyst position.</p>')]);
  assert.equal((await discoverSources({...input,title:'supply chain analyst',profession:'',fetchImpl:exact.fetchImpl})).results[0].kind,'documented');
});

test('attendance does not become sponsorship through another employer in the same sentence',async()=>{
  const {fetchImpl}=mockFetch([article('Industry event','<p>Example Systems attended a meeting where Other Employer launched software internships for HBCU students.</p>'),
    article('A roundup of employers','<p>Example Systems partnered with TMCF on an HBCU scholarship for artists. The other employer funded software engineering interns.</p>','https://tmcf.org/roundup/')]);
  const d=await discoverSources({...input,fetchImpl});
  assert.ok(d.results.every(r=>r.kind==='lead'));
});
