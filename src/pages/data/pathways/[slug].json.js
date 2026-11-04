import {timelineHistory} from '../../../lib/field-history.js';
import {professions, labelList} from '../../../lib/model';
import {matchIndex} from '../../../lib/discover-sources.js';
import health from '../../../../data/timeline-health-education.json';
import civic from '../../../../data/timeline-civic-trades.json';
import workplaces from '../../../../data/workplace-links.json';
import index from '../../../../data/discovery-index.json';

export function getStaticPaths(){
  return professions.map(p=>({params:{slug:p.slug},props:{p}}));
}

export function GET({props:{p}}){
  const historical=timelineHistory(p);
  const reviewers=workplaces.filter(row=>row.professions.includes(p.slug));
  // Only exact recipient/field matches that meet the discovery engine's funded
  // program criteria are eligible for an initial timeline. Leads stay in search.
  const awards=[];
  const publishers=new Set(index.records.map(r=>r.publisher));
  const issuers=new Set(index.records.filter(r=>r.issuer&&r.fundedFields?.includes(p.slug)).map(r=>r.issuer));
  for(const issuer of issuers){
    for(const row of matchIndex(index,{employer:issuer,title:p.name,profession:p.slug},publishers)){
      if(row.kind==='documented')awards.push({...row,issuer});
    }
  }
  const gate={label:p.gate.headline,rationale:p.gate.rationale,
    status:p.gate.status,citations:p.gate.citations};
  return new Response(JSON.stringify({slug:p.slug,name:p.name,historical,reviewers,awards,gate}),
    {headers:{'Content-Type':'application/json; charset=utf-8'}});
}
