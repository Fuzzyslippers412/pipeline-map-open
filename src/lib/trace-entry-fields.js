import {attachTraceCombobox} from './trace-combobox.js';
import {WorkplaceSearch,packDirectory} from './workplace-search.js';
import {searchRecipientNames} from './recipient-directory.js';
import {suggestJobTitles} from './title-suggestions.js';
import {loadTitleDirectory,resolveTitle} from './title-resolver.js';

export function setupTraceEntryFields(form,catalog,quickWorkplaces){
  const quick=new WorkplaceSearch();quick.add(packDirectory(quickWorkplaces));
  const fields={
    workplace:form.querySelector('#workplace-entry'),
    title:form.querySelector('#title-entry'),
  };
  const controls={}, current={}, cache={}, state={workplace:'loading',title:'loading'};
  const workplaceHint=document.querySelector('#workplace-affiliation');
  const titleHint=document.querySelector('#title-affiliation');
  const more=document.querySelector('#more-workplaces'),moreButton=document.querySelector('#search-federal-workplaces');
  const moreStatus=document.querySelector('#federal-status'),moreRows=document.querySelector('#federal-results');
  let selected=null,selectedTitle=null,worker=null,external=null,titleDirectory=null;

  function hint(node,text){node.textContent=text||'';node.hidden=!text}
  function updateFederalVisibility(){
    if(!more.hasAttribute('data-contextual'))return;
    const query=fields.workplace.value.trim().toLowerCase();
    const listed=cache.workplace?.some(option=>option.value.toLowerCase()===query);
    more.hidden=query.length<2 || !!selected || !!listed;
    if(more.hidden)more.open=false;
  }
  function setWorkplace(option){
    selected=option&&option.value===fields.workplace.value?{
      workplace:option.value,parent:option.parent||'',relation:option.relation||'',location:option.location||'',
      ...(option.id?{id:option.id}:{}),...(option.sourceUrl?{sourceUrl:option.sourceUrl}:{}),...(option.entered?{entered:option.entered}:{})
    }:null;
    const text=selected?[selected.parent?(selected.relation||'Parent organization')+': '+selected.parent:'',selected.location].filter(Boolean).join(' · '):'';
    hint(workplaceHint,text);
    updateFederalVisibility();
  }
  function ensureWorker(){
    if(worker)return worker;
    if(!window.Worker){state.workplace=state.title='unavailable';return null}
    try{
      worker=new Worker(new URL('./trace-suggest-worker.js',import.meta.url),{type:'module'});
    }catch{state.workplace=state.title='unavailable';return null}
    worker.postMessage({type:'configure',professions:catalog});
    worker.onmessage=({data})=>{
      if(data.type==='request-title-directory'){
        const requestingWorker=worker;
        loadTitleDirectory().then(directory=>{
          titleDirectory=directory;
          requestingWorker?.postMessage({type:'title-directory',directory});
        });
        return;
      }
      if(data.type!=='matches'||data.query!==current[data.field])return;
      cache[data.field]=data.options;state[data.field]=data.state;
      if(data.field==='workplace')updateFederalVisibility();
      controls[data.field]?.refresh();
    };
    // Both controls remain ordinary editable fields if a catalog is unavailable.
    worker.onerror=()=>{worker?.terminate();worker=null;state.workplace=state.title='unavailable';for(const control of Object.values(controls))control.refresh()};
    return worker;
  }
  function options(field,text){
    if(current[field]!==text){
      state[field]='loading';current[field]=text;
      cache[field]=[];
      ensureWorker()?.postMessage({field,query:text});
    }
    if(field==='workplace' && state[field]!=='ready' && !cache[field]?.length)return quick.search(text);
    if(field==='title' && state.title!=='ready' && !cache.title?.length){
      return suggestJobTitles(text,catalog).map(row=>({key:row.title,value:row.title,label:row.label,detail:row.subtitle,slug:row.slug}));
    }
    return cache[field]||[];
  }
  for(const [field,input] of Object.entries(fields)){
    controls[field]=attachTraceCombobox({
      input,popup:form.querySelector('#'+field+'-suggestions'),status:form.querySelector('#'+field+'-announcements'),
      preserveInput:field==='title',
      getOptions:text=>options(field,text),getState:()=>state[field],
      onPick:(option,committed,typed)=>{
        if(field==='workplace')setWorkplace(option && {...option,entered:typed.trim()});
        else {
          const original=typed.trim();
          selectedTitle=option ? {typed:original,lookup:committed.trim()} : null;
          hint(titleHint,option?'Looking up: '+committed.trim()+'. Your wording is kept.':'');
        }
      },
    });
    input.addEventListener('focus',()=>{
      ensureWorker()?.postMessage({field});
    });
  }
  function clearExternal(){
    external?.abort();external=null;
    moreRows.replaceChildren();moreStatus.textContent='';
    moreButton.disabled=fields.workplace.value.trim().length<2;
  }
  fields.workplace.addEventListener('input',()=>{setWorkplace(null);clearExternal()});
  fields.title.addEventListener('input',()=>{selectedTitle=null;hint(titleHint,'')});
  more.addEventListener('toggle',()=>{if(!more.open)clearExternal()});
  moreButton.addEventListener('click',async()=>{
    clearExternal();
    const query=fields.workplace.value.trim();
    if(query.length<2)return;
    const request=new AbortController();external=request;
    const timer=setTimeout(()=>request.abort(),7000);
    moreButton.disabled=true;moreStatus.textContent='Checking the U.S. Treasury directory…';
    try{
      const matches=await searchRecipientNames(query,request.signal);
      if(external!==request||fields.workplace.value.trim()!==query)return;
      for(const row of matches){
        const btn=document.createElement('button');btn.type='button';btn.className='registry-result';
        btn.textContent=row.value;
        btn.addEventListener('click',()=>{
          fields.workplace.value=row.value;
          fields.workplace.dispatchEvent(new Event('input',{bubbles:true}));
          setWorkplace(row);controls.workplace.close();more.open=false;fields.title.focus();
        });
        moreRows.append(btn);
      }
      moreStatus.textContent=matches.length?'Select a recipient name or keep your own text.':'No matching award recipient. You can still use your own workplace.';
    }catch{if(external===request)moreStatus.textContent='The federal directory is unavailable. You can still use your own workplace.'}
    finally{clearTimeout(timer);if(external===request){external=null;moreButton.disabled=false}}
  });
  return {
    get workplaceInfo(){return selected},
    get titleSelection(){return selectedTitle},
    selectTitle(typed,lookup){
      selectedTitle=lookup ? {typed,lookup} : null;
      hint(titleHint,lookup && lookup!==typed ? 'Selected title: '+lookup : '');
      controls.title.close();
    },
    example(name,site=null){
      this.clear();fields.workplace.value=name;
      if(site && site.name===name){setWorkplace({...site,value:name});return}
      const exact=quick.search(name).filter(row=>row.value===name);
      if(exact.length===1)setWorkplace(exact[0]);
    },
    restore(info){
      setWorkplace(info?.workplace===fields.workplace.value?{...info,value:info.workplace}:null);
      hint(titleHint,'');
      for(const [field,input] of Object.entries(fields)){
        if(document.activeElement===input)controls[field].open();else controls[field].close();
      }
      clearExternal();
    },
    clear(){
      selectedTitle=null;setWorkplace(null);hint(titleHint,'');controls.workplace.close();controls.title.close();clearExternal();
    },
  };
}
