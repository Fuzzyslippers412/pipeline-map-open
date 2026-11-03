import {paperColours as colours} from './plot.js';
export function compareModel(ids, data){
 const picked=[...ids].sort().map(id=>data.professions.find(p=>p.slug===id)).filter(Boolean);
 const rows=data.series.filter(p=>ids.includes(p.profession_id)&&['black_male','black_female'].includes(p.group));
 const families=new Map();
 for(const p of rows){
  const id=[p.family||p.series_family||p.series_id,p.measure,p.unit].join('|');
  if(!families.has(id))families.set(id,{label:p.measure_label||p.measure,unit:p.unit,family:p.family,rows:[]});
  families.get(id).rows.push(p);
 }
 const count=f=>new Set(f.rows.map(p=>p.profession_id)).size;
 const rank=f=>['acs-employed','acs-school-teachers'].includes(f.family)?3:f.family==='ipums-cps-employed'?2:1;
 const chosen=[...families.values()].sort((a,b)=>count(b)-count(a)||rank(b)-rank(a)||Math.max(...b.rows.map(p=>p.year))-Math.max(...a.rows.map(p=>p.year)))[0];
 const traces=[], latest=[];
 if(chosen)for(const [i,p] of picked.entries())for(const [j,g] of ['black_male','black_female'].entries()){
  const records=chosen.rows.filter(r=>r.profession_id===p.slug&&r.group===g).sort((a,b)=>a.year-b.year);
  if(records.length){traces.push({label:p.name+' · '+(j?'female':'male'),colour:colours[i],dash:!!j,rows:records});latest.push({name:p.name,point:records.at(-1)});}
 }
 return {picked,chosen,traces,latest,unavailable:picked.filter(p=>!latest.some(l=>l.name===p.name))};
}
