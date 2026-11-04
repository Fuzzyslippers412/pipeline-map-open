import {pmPathStory,workplaceStep,evidenceLabels,evidenceLabel} from './pm-path-model.js';
import {saveSuggestionDraft} from './nomination-draft.js';
const set=(root,key,value)=>{root.querySelector('[data-'+key+']').textContent=value};
export function renderPmPath(panel,role,employer='',sector='general',records=[]){
  const root=panel.querySelector('[data-pm-path]');if(!root)return;
  const story=pmPathStory(role,sector),work=workplaceStep(role,employer,sector,records);
  for(const [key,value] of Object.entries({
    'path-person':story.person,'path-date':story.date+' · '+story.place,'path-opportunity':story.opportunity,
    'path-change':story.change,'path-evidence':evidenceLabels[story.evidence],'path-role':story.name,
    'path-comparison':story.comparison,'path-workplace':work.label,'path-gap':work.description
  }))set(root,key,value);
  root.querySelector('[data-path-source]').href=story.sources[0][1];
  const source=root.querySelector('[data-path-workplace-source]');
  source.hidden=!work.record;
  if(work.record){source.href=work.record.url;source.textContent=evidenceLabel(work.record)+' ↗'}else source.removeAttribute('href');
  const next=panel.querySelector('[data-pm-next]');
  next._context={site:employer,profession:story.name};
  set(next,'record-needed',story.next);set(next,'record-question',story.question);
  next.querySelector('[data-refine]').textContent=employer?'Refine workplace':'Add your workplace';
}
export function resetPmNext(panel){
  const next=panel.querySelector('[data-pm-next]');if(!next)return;
  next.querySelector('[data-next-record]').hidden=true;
  next.querySelector('[data-next-toggle]').setAttribute('aria-expanded','false');
  next.querySelector('[data-question-status]').textContent='';
  next.querySelector('[data-question-fallback]').hidden=true;
}
export function bindPmNext(root){
  if(root.dataset.bound)return;root.dataset.bound='true';
  root.querySelector('[data-next-toggle]').addEventListener('click',()=>{
    const section=root.querySelector('[data-next-record]');section.hidden=!section.hidden;
    root.querySelector('[data-next-toggle]').setAttribute('aria-expanded',String(!section.hidden));
  });
  root.querySelector('[data-refine]').addEventListener('click',event=>{
    const input=document.querySelector('#workplace-entry');
    if(input){event.preventDefault();input.focus();input.scrollIntoView({block:'center',behavior:'instant'})}
  });
  root.querySelector('[data-suggest]').addEventListener('click',()=>saveSuggestionDraft(root._context));
  root.querySelector('[data-copy-question]').addEventListener('click',async()=>{
    const question=root.querySelector('[data-record-question]').textContent;
    const state=root._context;
    const value=(state?.site?'At '+state.site+':\n':'')+question;
    try{await navigator.clipboard.writeText(value);if(root._context===state)set(root,'question-status','Question copied.')}
    catch{
      if(root._context!==state)return;
      const fallback=root.querySelector('[data-question-fallback]');fallback.value=value;fallback.hidden=false;fallback.focus();fallback.select();
      set(root,'question-status','Select and copy the question below.');
    }
  });
}

export function focusPmPath(panel){
  const title=panel.querySelector('[data-pm-preview-title]');
  title.focus({preventScroll:true});
  panel.querySelector('[data-pm-path]').scrollIntoView({block:'start',behavior:'instant'});
}
