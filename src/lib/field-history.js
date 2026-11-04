import health from '../../data/timeline-health-education.json' with {type:'json'};
import civic from '../../data/timeline-civic-trades.json' with {type:'json'};
import histories from '../../data/history-index.json' with {type:'json'};
import workplaces from '../../data/workplace-links.json' with {type:'json'};
import credentials from '../../data/credential-records.json' with {type:'json'};
export const dossiers = histories;
export const expandedHistory = Object.fromEntries(dossiers.map(d=>[d.slug,d]));
export function historyFor(p){
 const expanded=expandedHistory[p.slug];
 const workplaceRecords=workplaces.filter(w=>w.professions.includes(p.slug));
 const events=expanded?.events || (health[p.slug]||civic[p.slug]||[]).map((e,i)=>({id:p.slug+'-'+i,date:e.dateLabel,year:e.sortYear,title:e.title,change:e.description,source:{title:e.sourceTitle,url:e.url,type:'Published history',locator:'Linked institutional account'},limit:'This starting record does not establish a connection to your workplace.'}));
 return {...expanded,slug:p.slug,headline:expanded?.headline||p.origin.headline,summary:expanded?.summary||p.origin.rationale,events:[...events].sort((a,b)=>a.year-b.year),expanded:!!expanded,
 coverageNote:expanded?.coverageNote||'A starting record. Decisions, worker outcomes and local implementation need further research.',
 question:expanded?.question||p.researchQuestion,
 furtherResearch:expanded?.furtherResearch||[p.researchQuestion],
 workplaceCount:workplaceRecords.length,workplaceRecords,
 credential:credentials.find(c=>c.slug===p.slug)||expanded?.credential};
}
export function timelineHistory(p){
 return historyFor(p).events.map(e=>({id:e.id,dateLabel:e.date,sortYear:e.year,title:e.title,description:[e.change,e.outcome,e.limit].filter(Boolean).join(' '),sourceTitle:e.source.title,url:e.source.url,sources:[e.source,...(e.sources||[])]}));
}
