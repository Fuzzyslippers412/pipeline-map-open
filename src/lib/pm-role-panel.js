import {renderPmPath,resetPmNext} from './pm-path-panel.js';
import {bindLookup} from './bind-lookup.js';
import {readTrace} from './trace-context.js';
import {resolveTitle} from './title-resolver.js';

export function currentPmWorkplace(role){
  const trace=readTrace();
  let match=trace && resolveTitle(trace.lookupTitle||trace.title,[]);
  for(const choice of trace?.choicePath||[])match=match?.choices?.find(item=>item.label===choice)?.result;
  return (match?.pmRole||(match?.projectSector?'project-manager':''))===role?trace.workplace:'';
}
export function bindPmEmployer(panel,workplace,sector='general'){
  const role=panel.dataset.pmHistory||'project-manager';
  panel._pathContext={role,workplace,sector};
  renderPmPath(panel,role,workplace,sector);
  const search=panel.querySelector('door-employer-records');
  bindLookup(search,workplace?{employer:workplace,sector}:null);
  resetPmNext(panel);
  if(!search || search.dataset.bound)return;
  search.dataset.bound='true';
  search.addEventListener('pm-record',({detail})=>{
    const ctx=panel._pathContext;
    if(!ctx||detail.employer!==ctx.workplace)return;
    renderPmPath(panel,ctx.role,ctx.workplace,ctx.sector,detail.records);
  });
}
export function showPmWorkplace(panel,workplace){
  bindPmEmployer(panel,workplace);
}
