import {WorkplaceSearch} from './workplace-search.js';
import {suggestJobTitles} from './title-suggestions.js';
const workplace=new WorkplaceSearch();
let titles=[],professions=[];
const started=new Map(),complete=new Set(),failed=new Set();
const last={workplace:null,title:null};
const resources={
  main:'/data/workplaces/main.json'+(import.meta.env.DEV?'/':''),
  schools:'/data/workplaces/schools.json'+(import.meta.env.DEV?'/':'')
};

function respond(field){
  const query=last[field];
  if(!query)return;
  const options=field==='workplace'?workplace.search(query):suggestJobTitles(query,professions,titles,5).map(t=>({
    key:t.title,value:t.title,label:t.label,detail:t.subtitle,slug:t.slug
  }));
  const keys=field==='title'?['titles']:['main','schools'];
  const state=keys.some(key=>!complete.has(key)&&!failed.has(key))?'loading':keys.some(key=>failed.has(key))?'unavailable':'ready';
  self.postMessage({type:'matches',field,query,options,state});
}
function load(key,field){
  if(started.has(key))return started.get(key);
  const job=fetch(resources[key],{credentials:'omit'}).then(async response=>{
    if(!response.ok)throw new Error('Directory unavailable');
    const records=await response.json();
    // Yield between batches so typing in the title field need not wait for
    // the complete national schools catalog to finish indexing.
    for(let i=0;i<records.rows.length;i+=3000){
      workplace.add({...records,rows:records.rows.slice(i,i+3000)});
      if(i+3000<records.rows.length)await new Promise(resolve=>setTimeout(resolve,0));
    }
    complete.add(key);respond(field);
  }).catch(()=>{failed.add(key);respond(field)});
  started.set(key,job);return job;
}
self.onmessage=({data})=>{
  if(data.type==='configure'){professions=data.professions;return}
  if(data.type==='title-directory'){
    titles=data.directory || [];
    (data.directory ? complete : failed).add('titles');
    respond('title');return;
  }
  const {field}=data;
  if(!Object.hasOwn(last,field))return;
  if(typeof data.query==='string'){last[field]=data.query;respond(field)}
  if(field==='title'){
    if(!started.has('titles')){
      started.set('titles',true);
      self.postMessage({type:'request-title-directory'});
    }
    return;
  }
  // The catalog URLs are fixed, independent of characters the reader types.
  load('main','workplace').then(()=>load('schools','workplace'));
};
