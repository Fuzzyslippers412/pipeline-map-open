import {findWorkplaceLinks} from './trace-context.js';

// A district decision may provide context for a selected school. It cannot
// supply the missing evidence for a campus with the same district parent.
export function teacherSchoolConnection(context, reviewers, matches, loadFailed=false) {
  const school=context.employer.trim();
  if(!school)return {label:'School connection · Gap',name:'No school entered',gap:'Add your school to check whether a decision reaches your workplace.'};
  if(loadFailed)return {label:'School connection · Unavailable',name:school,gap:'The workplace records could not be loaded. Retry the field history to check this school.'};

  const record=matches.find(row=>row.scope==='school' || row.scope==='district');
  if(record){
    const district=record.scope==='district';
    return {
      label:district?'District record · Campus unknown':'Documented at your school',
      name:record.workplace,record,
      gap:district?'This source covers the district. The link to an individual campus is still unknown.':
        'No record here links Marion’s teacher-training school to this campus.',
    };
  }
  const info=context.workplaceInfo;
  const district=info?.workplace===school && info.parent ?
    findWorkplaceLinks(info.parent,'k12-teacher',reviewers).find(row=>row.scope==='district') : null;
  return {
    label:district?'Campus gap · District evidence only':'School connection · Gap',name:school,record:district || null,
    gap:district?'This is a district decision. No source here shows how it reached this campus.':
      'No source here connects these teaching decisions to this school. A city and state can help distinguish schools with the same name.',
  };
}
