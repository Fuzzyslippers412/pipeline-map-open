const nursing={
  title:'D.C. nursing licensure',detail:'The D.C. Board of Nursing publishes its open meeting agendas and minutes. Look there for decisions about entry into licensed nursing.',
  label:'Board of Nursing meetings',url:'https://dchealth.dc.gov/event/board-nursing-monthly-meeting-agendas-and-minutes'
};
const chicago={
  title:'Cook County electrical apprenticeships',detail:'IBEW Local 134 and the Electrical Contractors’ Association sponsor training through IN-Tech. The institute publishes how applicants are selected.',
  label:'Read the selection criteria',url:'https://ejatt.com/about-in-tech/faqs/'
};
const districts={
  'Atlanta Public Schools':{title:'Atlanta Board of Education',detail:'The district publishes board meeting agendas. Look for the budget and staffing items being considered at the next meeting.',label:'Atlanta board agendas',url:'https://www.atlantapublicschools.us/boe'},
  'Norfolk City Public Schools':{title:'Norfolk School Board',detail:'The board sets district policy and approves its budget. Its public meeting records show which proposals it considered.',label:'Norfolk agendas and minutes',url:'https://go.boarddocs.com/vsba/nps/Board.nsf/Public'},
};
export function currentDecisionRecord(context,matches){
  if(context.profession==='registered-nurse' && matches.some(r=>r.workplace==='Howard University Hospital'))return nursing;
  if(context.profession==='electrician' && matches.some(r=>r.workplace.endsWith(', Chicago, IL') || r.workplace==='IBEW-NECA Technical Institute, Alsip, IL'))return chicago;
  if(context.profession==='k12-teacher'){
    const district=matches.find(r=>r.scope==='district')?.workplace ??
      matches.find(r=>r.site)?.site.parent ??
      (context.workplaceInfo?.workplace===context.employer ? context.workplaceInfo.parent : '');
    return Object.hasOwn(districts,district)?districts[district]:null;
  }
  return null;
}
