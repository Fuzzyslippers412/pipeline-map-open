import {readTrace,saveTrace} from './trace-context.js';
import {projectStories,projectSectors,sectorQuestions} from './project-work.js';
export function setProjectSector(panel,value,workplace='') {
  const sector=projectSectors.some(([key])=>key===value)?value:'general';
  const story=projectStories[sector] ? sector : 'general';
  panel.querySelector('select').value=sector;
  for(const entry of panel.querySelectorAll('[data-story]')) entry.hidden=entry.dataset.story!==story;
  panel.querySelector('[data-pm-scope]').hidden=story===sector;
  panel.querySelector('[data-pm-question]').textContent=sectorQuestions[sector];
  panel.querySelector('[data-pm-workplace]').textContent=workplace?'Still open at '+workplace:'Still open at your workplace';
  const link=panel.querySelector('[data-pm-map]');
  if(link)link.href='/career-map/project-manager/?sector='+sector;
}
export function bindProjectPanel(panel) {
  const inline=!!panel.querySelector('[data-pm-map]');
  if(!inline) setProjectSector(panel,new URLSearchParams(location.search).get('sector'));
  panel.querySelector('select').addEventListener('change',event=>{
    const sector=event.target.value;
    const workplace=inline?document.querySelector('#workplace-entry')?.value.trim():'';
    setProjectSector(panel,sector,workplace);
    if(inline){const saved=readTrace();if(saved)saveTrace({...saved,projectSector:sector})}
    if(!inline){const url=new URL(location.href);url.searchParams.set('sector',sector);history.replaceState(null,'',url)}
  });
}
