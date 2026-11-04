export function bindStudy(root=document){
 const allowed=['young','teen','adult'];
 const controls=[...root.querySelectorAll('[data-reader]')];
 function reader(value){
  const mode=allowed.includes(value)?value:'adult';
  root.querySelectorAll('[data-copy]').forEach(el=>{el.hidden=el.dataset.copy!==mode});
  controls.forEach(button=>button.setAttribute('aria-pressed',String(button.dataset.reader===mode)));
  root.querySelector('[data-reader-status]').textContent=({young:'Short explanations and questions to explore together.',teen:'A closer look at rules, institutions and choices.',adult:'Full research summaries, requirements and limits.'})[mode];
 }
 reader(new URL(location.href).searchParams.get('reader'));
 controls.forEach(button=>button.addEventListener('click',()=>{
  reader(button.dataset.reader);const url=new URL(location.href);url.searchParams.set('reader',button.dataset.reader);history.replaceState(null,'',url);
 }));
 root.querySelector('[data-study-share]')?.addEventListener('click',async()=>{
  const message=root.querySelector('[data-share-status]');
  try{await navigator.clipboard.writeText(location.href);message.textContent='Study link copied.'}catch{message.textContent=location.href}
 });
 const map=root.querySelector('[data-map]');
 if(map){
  let country='us',kind='';
  const links=[...map.querySelectorAll('[data-relationship]')];
  function select(id){
   links.forEach(link=>link.setAttribute('aria-pressed',String(link.dataset.relationship===id)));
   map.querySelectorAll('[data-relationship-panel]').forEach(panel=>{panel.hidden=panel.dataset.relationshipPanel!==id});
   map.querySelectorAll('[data-map-diagram]').forEach(diagram=>{diagram.hidden=diagram.dataset.mapDiagram!==id});
  }
  links.forEach(link=>link.addEventListener('click',()=>select(link.dataset.relationship)));
  function filter(){
   links.forEach(link=>{link.hidden=link.dataset.country!==country||Boolean(kind&&kind!==link.dataset.kind)});
   map.querySelector('[data-map-status]').textContent=(country==='us'?'United States':'Cameroon')+' · '+links.filter(link=>!link.hidden).length+' relationships';
   select(links.find(link=>!link.hidden)?.dataset.relationship);
  }
  map.querySelectorAll('[data-map-kind]').forEach(button=>button.addEventListener('click',()=>{
   map.querySelectorAll('[data-map-kind]').forEach(b=>b.setAttribute('aria-pressed',String(b===button)));kind=button.dataset.mapKind;filter();
  }));
  map.querySelectorAll('[data-map-country]').forEach(button=>button.addEventListener('click',()=>{
   map.querySelectorAll('[data-map-country]').forEach(b=>b.setAttribute('aria-pressed',String(b===button)));country=button.dataset.mapCountry;filter();
  }));
  filter();
 }
 root.querySelectorAll('[data-timeline-filter]').forEach(button=>button.addEventListener('click',()=>{
  root.querySelectorAll('[data-timeline-filter]').forEach(b=>b.setAttribute('aria-pressed',String(b===button)));
  const rows=[...root.querySelectorAll('[data-milestone]')];
  rows.forEach(row=>{row.hidden=Boolean(button.dataset.timelineFilter&&button.dataset.timelineFilter!==row.dataset.kind)});
  root.querySelector('[data-timeline-count]').textContent=rows.filter(row=>!row.hidden).length+' milestones shown';
 }));
 root.querySelectorAll('[data-learning-question]').forEach(question=>{
  question.querySelectorAll('[data-answer]').forEach(button=>button.addEventListener('click',()=>{
   question.querySelectorAll('[data-answer]').forEach(b=>b.setAttribute('aria-pressed',String(b===button)));
   const answer=question.querySelector('[data-answer-note]');answer.hidden=false;
   question.querySelector('[data-answer-result]').textContent=button.dataset.answer==='supported'?'That fits the record.':'Check this distinction.';
  }));
 });
}
