import {bindPmEmployer,currentPmWorkplace} from './pm-role-panel.js';
import {readTrace,saveTrace} from './trace-context.js';
import {projectStories,projectSectors} from './project-work.js';
export function setProjectSector(panel,value,workplace='') {
  const sector=projectSectors.some(([key])=>key===value)?value:'general';
  const story=projectStories[sector] ? sector : 'general';
  bindPmEmployer(panel,workplace,sector);
  panel.querySelector('[data-history-detail]').open=false;
  panel.querySelector('select').value=sector;
  for(const entry of panel.querySelectorAll('[data-story]')) entry.hidden=entry.dataset.story!==story;
  panel.querySelector('[data-pm-scope]').hidden=story===sector;
  const link=panel.querySelector('[data-pm-map]');
  if(link)link.href='/career-map/project-manager/?sector='+sector;
}
export function bindProjectPanel(panel) {
  const inline=!!panel.querySelector('[data-pm-map]');
  if(!inline){const restore=()=>setProjectSector(panel,new URLSearchParams(location.search).get('sector'),currentPmWorkplace('project-manager'));restore();window.addEventListener('pageshow',restore)}
  panel.querySelector('select').addEventListener('change',event=>{
    const sector=event.target.value;
    const workplace=inline?document.querySelector('#workplace-entry')?.value.trim():currentPmWorkplace('project-manager');
    setProjectSector(panel,sector,workplace);
    if(inline){const saved=readTrace();if(saved)saveTrace({...saved,projectSector:sector})}
    if(!inline){const url=new URL(location.href);url.searchParams.set('sector',sector);history.replaceState(null,'',url)}
  });
}
