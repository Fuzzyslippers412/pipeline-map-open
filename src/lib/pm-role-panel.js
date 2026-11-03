import {pmWorkplaceRecord} from './pm-role-records.js';
export function showPmWorkplace(panel,workplace){
  const gap=pmWorkplaceRecord(panel.dataset.pmHistory,workplace);
  panel.querySelector('[data-pm-gap-label]').textContent=gap.label;
  panel.querySelector('[data-pm-gap-text]').textContent=gap.text;
}
