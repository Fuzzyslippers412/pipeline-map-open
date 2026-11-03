import assert from 'node:assert/strict';
import test from 'node:test';
import {packDirectory,WorkplaceSearch} from '../src/lib/workplace-search.js';
import {readTrace,saveTrace,clearTrace} from '../src/lib/trace-context.js';
const index=new WorkplaceSearch();
index.add(packDirectory([
 {name:'Howard University',location:'Washington, DC'},
 {name:'Howard University Hospital',parent:'Howard University',relation:'University affiliation',location:'Washington, DC',reviewed:true},
 {name:'Lincoln Elementary School',parent:'Hamilton Public Schools',relation:'School district',location:'Hamilton, NJ'},
 {name:'Lincoln Elementary School',parent:'Salem School District',relation:'School district',location:'Salem, OR'},
 {name:'HOWARD UNIVERSITY HOSPITAL'},
]));
test('site leads when searching a common name; verified parent remains separate',()=>{
 const [site]=index.search('howard');
 assert.equal(site.value,'Howard University Hospital');
 assert.equal(site.detail,'University affiliation: Howard University');
 assert.equal(index.search('Howard University')[0].value,'Howard University');
 assert.equal(index.search('howard').filter(x=>x.value.toLowerCase()==='howard university hospital').length,1);
});
test('site, district and city matches preserve same-name branches',()=>{
 const sites=index.search('lincoln');
 assert.equal(sites.length,2);assert.notEqual(sites[0].key,sites[1].key);
 assert.equal(index.search('Hamilton Public')[0].value,'Lincoln Elementary School');
 assert.equal(index.search('lincoln salem')[0].location,'Salem, OR');
 assert.deepEqual(index.search('Zephyrian pottery workshop'),[]);
});
test('unmapped entries survive refresh with their exact employer, never the parent',()=>{
 const values=new Map();globalThis.window={sessionStorage:{getItem:k=>values.get(k)??null,setItem:(k,v)=>values.set(k,v),removeItem:k=>values.delete(k)}};
 const info={workplace:'Lincoln Elementary School',parent:'Hamilton Public Schools',relation:'School district',location:'Hamilton, NJ'};
 assert.equal(saveTrace({slug:'',match:'unmapped',title:'Custom studio technician',workplace:info.workplace,workplaceInfo:info}),true);
 assert.equal(readTrace().workplace,'Lincoln Elementary School');assert.deepEqual(readTrace().workplaceInfo,info);
 saveTrace({slug:'',match:'unmapped',title:'Custom studio technician',workplace:'My own workshop',workplaceInfo:info});
 assert.equal(readTrace().workplaceInfo,null);
 clearTrace();assert.equal(readTrace(),null);delete globalThis.window;
});

test('a selected occupation and its clarification survive a round trip to related history',()=>{
 const values = new Map();
 globalThis.window = {sessionStorage:{getItem:k=>values.get(k)??null,setItem:(k,v)=>values.set(k,v),removeItem:k=>values.delete(k)}};
 try {
  const choicePath = ['Keeping software services reliable'];
  const draft = {title:'SRE',lookupTitle:'Site Reliability Engineer',choicePath,workplace:'An unlisted office'};
  for(const [match,slug] of [['unmapped',''],['related','software-engineer']]){
   assert.equal(saveTrace({...draft,match,slug}),true);
   const trace = readTrace();
   assert.equal(trace.title,'SRE');
   assert.equal(trace.lookupTitle,'Site Reliability Engineer');
   assert.deepEqual(trace.choicePath,choicePath);
   assert.equal(trace.workplace,draft.workplace);
  }
 } finally {
  delete globalThis.window;
 }
});
