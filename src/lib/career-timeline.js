import {employerKey} from './employer-key.js';
import {findWorkplaceLinks} from './trace-context.js';

function sources(items){
  return (items||[]).filter(item=>{
    if(!item?.title)return false;
    try{const url=new URL(item.url);return url.protocol==='https:'&&!url.username&&!url.password}
    catch{return false}
  });
}
function dateKey(year){return Number.isInteger(year)?year*10000:null}
function dateForAward(record){
  // An edition date or an article's publication date cannot date an award.
  if(record.dateBasis!=='award'||!record.publishedOn)return null;
  const m=/^(\d{4})(?:-(\d{2})(?:-(\d{2}))?)?$/.exec(record.publishedOn);
  if(!m)return null;
  const key=Number(m[1])*10000+Number(m[2]||0)*100+Number(m[3]||0);
  if(!m[2])return {key,label:m[1]};
  const value=new Date(record.publishedOn+(m[3]?'T00:00:00Z':'-01T00:00:00Z'));
  if(!Number.isFinite(value.getTime()))return null;
  return {key,label:new Intl.DateTimeFormat('en-US',{year:'numeric',month:'short',...(m[3]?{day:'numeric'}:{}),timeZone:'UTC'}).format(value)};
}
function historyStep(item){
  return {type:'history',historyEventId:item.id,label:'Field history',date:item.dateLabel,order:dateKey(item.sortYear),
    title:item.title,detail:item.description,place:item.place,sources:sources(item.sources || [{title:item.sourceTitle,url:item.url}])};
}
function workplaceStep(row, paper=false){
  const bridge=row.fromInstitution&&row.toInstitution?row.fromInstitution+' → '+row.toInstitution:'';
  const label=({contractor:'Contractor history',union:'Union history',jobsite:'Jobsite record',program:'Training program',appointment:'Appointment record',election:'Reported election result',office:'Public office record',institution:'Institutional record'})[row.scope] || 'Workplace history';
  return {type:'employer',label,date:row.eventDateLabel||'Date undocumented',order:dateKey(row.eventYear),
    title:(paper && row.paperTitle) || row.headline,detail:row.description,place:row.place || row.site?.location,scope:row.scope,
    paperRole:paper ? row.paperRole : undefined,previewDetail:row.previewDetail || '',sourceNote:row.sourceNote,bridge,historyEventId:row.historyEventId,
    sources:sources([{title:row.sourceTitle,url:row.url}, ...(row.moreSources || [])])};
}
function awardStep(row){
  const when=dateForAward(row);
  const stamp=row.mode==='live'?'Retrieved live':row.indexedOn?'Indexed '+row.indexedOn:'Indexed award';
  const basis=when?(row.dateDetail||'Award record date'):(row.dateBasis==='publication'&&row.publishedOn?'Source published '+row.publishedOn+'; event date unknown':'Event date unknown');
  return {type:'award',label:'Workplace funding',date:when?.label||'Date undocumented',order:when?.key??null,
    title:row.title,detail:row.excerpt,meta:basis+' · '+stamp,sources:sources([{title:row.publisher+' · Award record',url:row.url}])};
}
function gap(title,detail){
  return {type:'gap',label:'Gap in the record',date:'Unknown',title,detail,sources:[]};
}

export function buildCareerTimeline({context,field,report=null,loadFailed=false,paper=false}){
  const {employer='',title,related=false}=context;
  const history=(field?.historical||[]).map(historyStep).filter(step=>step.sources.length);
  const verified=field?findWorkplaceLinks(employer,field.slug,field.reviewers||[],context.workplaceInfo,{related,occupationCode:context.occupationCode,contextKey:context.contextKey}):[];
  const employerEvents=verified.flatMap(row=>{
    const events=[workplaceStep(row,paper)];
    if(paper && row.paperMilestone) {
      events.push(workplaceStep({place:row.place,scope:row.scope,...row.paperMilestone},true));
    }
    return events;
  }).filter(step=>step.sources.length);
  const funding=new Map();
  if(employer && !related){
    for(const record of field?.awards||[]){
      if(record.kind==='documented'&&employerKey(record.issuer)===employerKey(employer))funding.set(record.url,record);
    }
  }
  for(const record of report?.results||[]){
    if(record.kind==='documented'&&employer){
      const old=funding.get(record.url);
      // A fresh lookup may omit a date that the dated edition documented. Keep
      // the edition's provenance for that date rather than mixing the sources.
      if(!old||dateForAward(record)||!dateForAward(old))funding.set(record.url,record);
    }
  }
  const awards=[...funding.values()].map(awardStep).filter(step=>step.sources.length);
  for(const step of employerEvents){
    const episode=step.historyEventId&&history.find(row=>row.historyEventId===step.historyEventId);
    step.connectsHistory=Boolean(episode);
    if(episode)step.fieldEpisode=episode;
  }
  // The same appointment can appear in both the field dossier and workplace
  // index. Show that event once, retaining the workplace-specific explanation.
  const fieldEvents=history.filter(h=>!employerEvents.some(e=>e.order===h.order&&
    ((e.historyEventId&&e.historyEventId===h.historyEventId)||(e.title===h.title&&e.sources.some(s=>h.sources.some(t=>s.url===t.url))))));
  const events=[...fieldEvents,...employerEvents,...awards].sort((a,b)=>
    (a.order??Infinity)-(b.order??Infinity)||a.title.localeCompare(b.title));
  if(!history.length){
    events.unshift(gap('The opening of this field is undocumented here',
      loadFailed?'The profession record could not be loaded.':field?'This edition has no verified historical milestone for this field.':'Door Notes hasn’t yet linked a reviewed field history to your title.'));
  }
  const hasWorkplace=employerEvents.length+awards.length>0;
  const leadCount=(report?.results||[]).filter(r=>r.kind==='lead').length;
  if(employer){
    const bridge=employerEvents.find(step=>step.bridge)?.bridge;
    const reason=bridge?
      'The workplace source documents '+bridge+'. Its link to the field history is still unknown.':
      hasWorkplace?'A source names this workplace. The evidence here does not connect its history to the field milestones.':
      'No source in this timeline connects the field history to this workplace.';
    const extra=leadCount?' The search returned '+leadCount+(leadCount===1?' lead':' leads')+' to investigate below.':'';
    const position=events.findIndex(s=>s.type==='award'||s.type==='employer');
    const heading='The field and '+employer;
    // A reviewed record can link one named episode to this exact workplace.
    // Do not describe that established connection as unknown. The reader's
    // personal training and hiring gap still appears below.
    if(!employerEvents.some(step=>step.connectsHistory))events.splice(position<0?events.length:position,0,gap(heading,reason+extra));
  }else if(!employer){
    events.push(gap('Which workplace connects to this history?','No workplace was entered. Add an employer to check for a documented institutional connection.'));
  }
  if(field?.gate){
    const refs=sources(field.gate.citations);
    if(refs.length)events.push({type:'gate',label:field.gate.status==='draft'?'Editorial · proposed':'Editorial interpretation',date:'Today',
      title:'Who shapes entry today?',detail:field.gate.rationale,meta:field.gate.label+' · profession-wide',sources:refs});
  }
  if(employer){
    events.push(gap('Your route into this job','Public records here do not establish how you trained, applied or were hired'+(hasWorkplace?', or whether you participated in a listed program.':'.')));
  }
  events.push({type:'self',label:'Your entry',date:'Today',title,detail:employer?'At '+employer:'Workplace not entered.',
    meta:related&&field?'You selected '+field.name+' as a related field.':'',sources:[]});
  return events;
}
