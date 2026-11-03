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
  return {type:'history',label:'Field history',date:item.dateLabel,order:dateKey(item.sortYear),
    title:item.title,detail:item.description,sources:sources([{title:item.sourceTitle,url:item.url}])};
}
function workplaceStep(row){
  const bridge=row.fromInstitution&&row.toInstitution?row.fromInstitution+' → '+row.toInstitution:'';
  return {type:'employer',label:'Workplace history',date:row.eventDateLabel||'Date undocumented',order:dateKey(row.eventYear),
    title:row.headline,detail:row.description,bridge,sources:sources([{title:row.sourceTitle,url:row.url}])};
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

export function buildCareerTimeline({context,field,report=null,loadFailed=false}){
  const {employer='',title,related=false}=context;
  const history=(field?.historical||[]).map(historyStep).filter(step=>step.sources.length);
  const verified=field&&!related?findWorkplaceLinks(employer,field.slug,field.reviewers||[],context.workplaceInfo):[];
  const employerEvents=verified.map(workplaceStep).filter(step=>step.sources.length);
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
  const events=[...history,...employerEvents,...awards].sort((a,b)=>
    (a.order??Infinity)-(b.order??Infinity)||a.title.localeCompare(b.title));
  if(!history.length){
    events.unshift(gap('The opening of this field is undocumented here',
      loadFailed?'The profession record could not be loaded.':field?'This edition has no verified historical milestone for this field.':'There is no matched profession history for the title you entered.'));
  }
  const hasWorkplace=employerEvents.length+awards.length>0;
  const leadCount=(report?.results||[]).filter(r=>r.kind==='lead').length;
  if(employer){
    const bridge=employerEvents.find(step=>step.bridge)?.bridge;
    const reason=bridge?
      'The workplace source documents '+bridge+'. Whether the earlier field openings led to that specific institutional connection is undocumented.':
      hasWorkplace?'A record names this employer, but the sources here do not establish how the earlier field history led to this workplace.':
      'No source in this timeline establishes a connection between this workplace and the field’s earlier institutions.';
    const extra=leadCount?' The search returned '+leadCount+(leadCount===1?' lead':' leads')+' to investigate below.':'';
    const position=events.findIndex(s=>s.type==='award'||s.type==='employer');
    const heading=bridge?'From the field’s openings to this workplace':'How the path reached '+employer;
    events.splice(position<0?events.length:position,0,gap(heading,reason+extra));
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
