import medicine from '../../data/institutions/medicine.json' with {type:'json'};
import {professions} from './model.js';
import {historyFor} from './field-history.js';

export const studies=[medicine];
export const studyFor=slug=>studies.find(study=>study.slug===slug);
export const sections=[
 {id:'origins',label:'Origins',title:'Where did the profession come from?',question:'Who cared for people before today’s institutions existed?'},
 {id:'builders',label:'Builders & money',title:'Who built it—and who paid?',question:'What can a funding record tell us? What can’t it tell us?'},
 {id:'access',label:'Access & exclusion',title:'Why were some doors closed?',question:'Was the barrier a rule, a cost, a decision—or more than one?'},
 {id:'doors',label:'Changing the rules',title:'Who opened a door or built another?',question:'What changed because people worked together?'},
 {id:'authority',label:'Authority today',title:'Who can decide what today?',question:'Does owning a building give someone permission to treat a patient?'},
 {id:'ownership',label:'Access & ownership',title:'A job, a practice, an institution.',question:'What changes when you own a workplace instead of working in it?'},
 {id:'build',label:'Your possibilities',title:'What could you help build?',question:'Which part would you like to understand or improve?'}
];
export const evidenceLabels={documented:'Documented record',interpretation:'Scholarly interpretation',disputed:'Disputed or conflicting',question:'Open research question'};
export const modes=[{id:'young',label:'Young explorers',ages:'About 8–12'},{id:'teen',label:'Teen explorers',ages:'About 13–17'},{id:'adult',label:'Career explorers',ages:'18+ · deeper reading'}];
export const sourceRefs=(study,ids=[])=>ids.map(id=>study.sources.find(source=>source.id===id)).filter(Boolean);
export const validMode=value=>modes.some(mode=>mode.id===value)?value:'adult';

export function discoveryRecords(){
 return professions.map(p=>{
  const history=historyFor(p),study=studyFor(p.slug),credential=history.credential;
  const institutions=new Set();
  for(const row of history.workplaceRecords){
   const words=(row.roleScope||'')+' '+row.workplace;
   if(/university|college|school|faculty|education/i.test(words))institutions.add('education');
   if(/hospital|clinic|pharmacy/i.test(words))institutions.add('health');
   if(/government|law department|office|NASA|state of/i.test(words)||['office','election'].includes(row.scope))institutions.add('public');
   if(['ownership','contractor'].includes(row.scope)||/Boeing|Google/i.test(row.workplace))institutions.add('business');
   if(row.scope==='union')institutions.add('union');
  }
  return {slug:p.slug,name:p.name,sector:p.sector,episodes:history.events.length,study:Boolean(study),
   countries:study?['us','cm']:['us'],years:history.events.map(event=>event.year),
   education:credential?'credential':'unreviewed',credential:credential?.credential||'',
   institutions:[...institutions],ownership:history.workplaceRecords.some(row=>row.scope==='ownership')||Boolean(study),
   related:(p.aliases||[]).join(' ')};
 });
}
export {filterDiscovery} from './study-discovery.js';
