import {normalizeEmployerText} from './employer-key.js';

// Summarize the same steps used by the full timeline. A first-in-time event is
// the earliest one in this record; it is not necessarily the first in history.
function openingPreview(steps,context,loadFailed,preferredId) {
  const candidate=(preferredId&&steps.find(step=>(step.type==='history'||step.connectsHistory)&&step.historyEventId===preferredId&&step.sources.length))||steps.find(step=>step.type==='history' && step.sources.length);
  const opening=candidate?.fieldEpisode||candidate;
  if(!opening){
    if(loadFailed)return {title:'Field history unavailable',detail:'The profession record could not be loaded.',date:'',sources:[]};
    if(!context.profession)return {title:'A history for this title is still open',detail:'Door Notes hasn’t yet linked a published field history to your title.',date:'',sources:[]};
    return {title:'No sourced opening in this field yet',detail:'The profession record contains no verified historical milestone.',date:'',sources:[]};
  }
  const sentence=firstSentence(opening.detail);
  const detail=context.related ? 'From the related field you selected. '+sentence : sentence;
  return {title:opening.title,detail,date:opening.date,place:opening.place,sources:opening.sources};
}

// Keep a complete source-backed sentence; dates and proper names must not be
// clipped by a word or character budget. A title already carries its actor/action.
function firstSentence(paragraph) {
  for(const stop of paragraph.matchAll(/[.!?](?=\s|$)/g)){
    const sentence=paragraph.slice(0,stop.index+1);
    if(!/(?:\b(?:[A-Z]\.)+|\b(?:Dr|Mr|Mrs|Ms|St|No)\.)$/.test(sentence))return sentence.trim();
  }
  return paragraph;
}

function relevance(step) {
  const dated=Number.isFinite(step.order);
  if(step.type==='employer' && step.bridge && dated)return 5;
  if(step.type==='employer' && dated)return 4;
  if(step.type==='award' && dated)return 3;
  if(step.type==='employer')return 2;
  return 1;
}

function reviewedWorkplace(step,matches) {
  // These employer steps are already vetted for both the submitted workplace
  // and profession. Connect two of them only when the earlier source actually
  // names the institution on the starting side of the reviewed bridge.
  const predecessor=normalizeEmployerText(step.bridge?.split(' → ')[0]);
  const prior=predecessor && matches.find(row=>row.type==='employer' &&
    Number.isFinite(row.order) && row.order<step.order &&
    (' '+normalizeEmployerText(row.title+' '+row.detail)+' ').includes(' '+predecessor+' '));
  const sources=prior ? [...new Map([...step.sources,...prior.sources].map(source=>[source.url,source])).values()] : step.sources;
  return {title:step.title,detail:firstSentence(prior ? prior.detail : step.detail),date:step.date,place:step.place,scope:step.scope,sourceNote:step.sourceNote,historyEventId:step.historyEventId,connectsHistory:step.connectsHistory,dated:Number.isFinite(step.order),sources};
}

function workplacePreview(steps,context,loadFailed,report) {
  if(!context.employer)return {title:'No workplace entered',detail:'Add a workplace to check for an institutional connection.',date:'',sources:[]};
  const matches=steps.filter(step=>['employer','award'].includes(step.type) && step.sources.length);
  matches.sort((a,b)=>relevance(b)-relevance(a) || (b.order??0)-(a.order??0));
  const step=matches[0];
  if(step){
    if(step.type==='employer')return reviewedWorkplace(step,matches);
    // Keep the date-basis and index/retrieval label of any cited funding
    // record. The date of an index edition cannot be used to date an award.
    return {title:step.title,detail:'Workplace funding · '+step.meta,date:step.date,dated:Number.isFinite(step.order),sources:step.sources};
  }
  const leadCount=(report?.results||[]).filter(row=>row.kind==='lead').length;
  let detail='Check workplace sources for published evidence.';
  if(leadCount)detail=leadCount===1?'One research lead needs checking before a connection can be drawn.':leadCount+' research leads need checking before a connection can be drawn.';
  else if(loadFailed)detail='The profession record could not be checked.';
  else if(report?.status==='unavailable')detail='Live checks were unavailable, and this timeline has no verified match.';
  else if(report?.status==='partial')detail='Some sources were unavailable. The completed checks found no match.';
  else if(report)detail='The sources checked returned no documented workplace connection.';
  return {title:'No documented link to '+context.employer,detail,date:'',sources:[]};
}

export function buildTimelinePreview({steps,context,loadFailed=false,report=null}) {
  const localOpening=steps.find(step=>step.paperRole==='opening');
  const localWorkplace=steps.find(step=>step.paperRole==='workplace');
  const localPair=Boolean(localOpening && localWorkplace);
  const workplace=localPair ? reviewedWorkplace(localWorkplace,steps.filter(step=>step.type==='employer')) :
    workplacePreview(steps,context,loadFailed,report);
  const opening=localPair ? {
    title:localOpening.title,detail:localOpening.previewDetail,date:localOpening.date,
    place:localOpening.place,sources:localOpening.sources,
  } : openingPreview(steps,context,loadFailed,workplace.connectsHistory?workplace.historyEventId:undefined);
  const gaps={};
  if(!opening.sources.length)gaps.opening=loadFailed?'Field history could not be checked.':'A source is still needed for who opened access to this role.';
  if(!context.employer)gaps.workplace='No workplace was entered for this trace.';
  else{
    if(!workplace.connectsHistory)gaps.workplace=workplace.sources.length?
      'Whether the field and workplace records connect.':
      'Whether this workplace connects to the field’s history.';
    gaps.route='How you personally trained or were hired.';
  }
  const items=Object.values(gaps);
  return {opening,workplace,localPair,gaps:{
    title:items.length+(items.length===1?' gap':' gaps')+' in the record',
    detail:'',items,kinds:Object.keys(gaps),
  }};
}

// The paper edition shortens a dated record only when its title and place
// already describe the event. Preserve the date basis of funding records and
// the diagnostic text for unavailable, partial or inconclusive searches.
export function schoolRecordPreview(preview,context,{report=null,loadFailed=false}={}) {
  const {opening,workplace,gaps}=preview;
  const hasSchool=Boolean(context.employer);
  const hasWorkplaceRecord=workplace.sources.length>0;
  const hasGap=hasSchool && !hasWorkplaceRecord;
  const schoolGap='We haven’t found a record connecting this history to your school.';
  const district=workplace.scope==='district';
  const schoolTitle=hasGap ? (loadFailed?'School records unavailable':schoolGap) : workplace.title;
  const statements={
    workplace: hasWorkplaceRecord
      ? (district?'A district record does not establish what happened at a particular school.':'No source here connects the two records.')
      : (!hasSchool?'No school was entered.':(loadFailed?'The school records could not be checked.':'A board decision or staff record could help establish the school connection.')),
    route:'Your own training and hiring route is still unknown.'
  };
  return {
    opening:{...opening,detail:opening.place?'':opening.detail},
    workplace:{
      ...workplace,title:schoolTitle,
      detail:(workplace.place && workplace.scope==='school') || (hasGap && !report && !loadFailed) ? '' : workplace.detail,
      label:district?'District record':workplace.scope==='school'?'At your school':hasWorkplaceRecord?'Workplace funding':'Your school',
      showSearch:hasGap && !loadFailed,
    },
    gaps:{...gaps,items:gaps.items.map((item,index)=>statements[gaps.kinds[index]]??item)}
  };
}


const workplaceLabels = {
  hospital: 'At your hospital',
  contractor: 'Contractor record',
  union: 'Union local record',
  jobsite: 'Jobsite record',
  program: 'Training program record',
  institution: 'Institutional record',
  appointment: 'Appointment record',
  'historical-record': 'Historical workplace record',
  leadership: 'Technical leadership record',
};

export function paperRecordPreview(preview, context, {report=null, loadFailed=false}={}) {
  if (context.profession==='k12-teacher') return schoolRecordPreview(preview, context, {report,loadFailed});
  if (context.related || !['registered-nurse','electrician'].includes(context.profession)) return preview;

  const {opening,workplace,gaps} = preview;
  const hasWorkplace = Boolean(context.employer);
  const nursing = context.profession==='registered-nurse';
  const documented = workplace.sources.length>0;
  const missing = hasWorkplace && !documented;
  const label = workplaceLabels[workplace.scope] || (documented ? 'Workplace funding' : 'Your workplace');
  let title = workplace.title;
  if (missing) title = loadFailed ? 'Workplace records unavailable' : 'We haven’t found a record connecting this history to your workplace.';
  let workplaceGap = 'A record naming this workplace could establish a connection.';
  if (!hasWorkplace) workplaceGap='No workplace was entered.';
  else if (loadFailed && !documented) workplaceGap='The workplace records could not be checked.';
  else if (preview.localPair) {
    workplaceGap=nursing ? 'No placement record here shows which graduates joined the hospital.' :
      'The project records do not name the crew assigned to Soldier Field.';
  } else if (documented) {
    if (workplace.scope==='hospital' && opening.place==='Tuskegee, Alabama' && workplace.place==='Washington, D.C.')
      workplaceGap='No record here connects Tuskegee’s school to Howard’s nursing program.';
    else if (opening.place==='New York City' && ['contractor','union','jobsite','program'].includes(workplace.scope))
      workplaceGap='No source here connects the New York recruitment decision to this Illinois record.';
    else workplaceGap=workplace.scope ? 'The connection between these two records is still unknown.' : 'The funding record leaves its connection to field history unknown.';
  } else if (nursing) workplaceGap='A hospital training agreement could help establish the workplace connection.';
  else workplaceGap='A union agreement or contractor record naming this workplace could establish the connection.';

  const routeGap = {
    program:'Your admission, training and hiring route are still unknown.',
    union:'Your union membership and hiring route are still unknown.',
    jobsite:'Your work assignment and crew are still unknown.',
    contractor:'Your own training and hiring route is still unknown.',
    hospital:'Your own training and hiring route is still unknown.',
  }[workplace.scope] || 'Your own training and hiring route is still unknown.';
  const statements = {workplace:workplaceGap,route:routeGap};
  return {
    opening:{...opening, detail:opening.place && !preview.localPair ? '' : opening.detail},
    workplace:{
      ...workplace, label:preview.localPair && workplace.scope==='contractor'?'Your employer’s project':label, title, showSearch:missing && !loadFailed,
      detail: workplace.sourceNote || (missing && !report && !loadFailed) ? '' : workplace.detail,
    },
    gaps:{...gaps,items:gaps.items.map((item,index)=>statements[gaps.kinds[index]] ?? item)},
  };
}
