const scopes={
  contractor:['Documented contractor','The project record leaves your own crew, training and hiring route unknown.'],
  union:['Documented union local','Union history leaves your employer, jobsite and membership unknown.'],
  jobsite:['Documented jobsite','The source names work at this site. It does not identify your crew or personal assignment.'],
  program:['Documented training program','Whether you trained here or worked for a participating contractor remains unknown.'],
};
export function electricianConnection(context,matches,loadFailed=false){
  const name=context.employer.trim();
  if(!name)return {label:'Workplace connection · Gap',name:'No workplace entered',gap:'Add a contractor, a union local with its city, or a named jobsite to check for a connection.'};
  if(loadFailed)return {label:'Workplace records unavailable',name,gap:'Retry the field history to check this workplace.'};
  const record=matches.find(row=>Object.hasOwn(scopes,row.scope));
  if(record){
    const [label,gap]=scopes[record.scope];
    const bridge=record.workplace==='Taylor Electric Company, Chicago, IL' ?
      {detail:'Taylor Electric also lists electrical maintenance at Soldier Field in its project portfolio.',label:'See the Soldier Field project',url:'https://taylorelectricco.com/portfolio-item/soldier-field/'} :
      record.workplace==='IBEW Local 134, Chicago, IL' ?
      {detail:'Taylor Electric directs aspiring electricians to Local 134 for entry as apprentices.',label:'Taylor Electric career information',url:'https://taylorelectricco.com/about/careers/'} : null;
    return {label,name:record.workplace,record,bridge,gap};
  }
  return {label:'Workplace connection · Gap',name,gap:'No reviewed source here ties these decisions to this workplace. A union agreement, training record or project document naming it could fill this gap.'};
}
