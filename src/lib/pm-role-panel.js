import {pmWorkplaceRecord} from './pm-role-records.js';
import {bindLookup} from './bind-lookup.js';
import {readTrace} from './trace-context.js';
import {resolveTitle} from './title-resolver.js';

export function currentPmWorkplace(role){
  const trace=readTrace();
  let match=trace && resolveTitle(trace.lookupTitle||trace.title,[]);
  for(const choice of trace?.choicePath||[])match=match?.choices?.find(item=>item.label===choice)?.result;
  return (match?.pmRole||(match?.projectSector?'project-manager':''))===role?trace.workplace:'';
}
export function bindPmEmployer(panel,workplace){
  const search=panel.querySelector('door-employer-records');
  bindLookup(search,workplace?{employer:workplace}:null);
  if(!search || search.dataset.bound)return;
  search.dataset.bound='true';
  search.addEventListener('pm-record',({detail})=>{
    if(!detail.historical)return;
    const label=panel.querySelector('[data-pm-gap-label],[data-pm-workplace]');
    label.textContent='Workplace record found · '+detail.employer;
    const text=panel.querySelector('[data-pm-gap-text]');
    if(text)text.textContent=detail.historical.limit;
  });
}
export function showPmWorkplace(panel,workplace){
  bindPmEmployer(panel,workplace);
  const gap=pmWorkplaceRecord(panel.dataset.pmHistory,workplace);
  panel.querySelector('[data-pm-gap-label]').textContent=gap.label;
  panel.querySelector('[data-pm-gap-text]').textContent=gap.text;
}
