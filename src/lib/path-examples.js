// Build-time only. A public example always contains the same published inputs.
import schools from '../../data/workplace-schools.json';
import workplaces from '../../data/workplace-directory.json';
const school=schools.records.find(row=>row.id==='nces-school-130012004174');
const hospital=workplaces.records.find(row=>row.name==='Howard University Hospital' && row.parent);
export const pathExamples=[
  {slug:'registered-nurse',id:'try-trace',label:'Nurse at Howard University Hospital',workplace:'Howard University Hospital',title:'Registered nurse',site:hospital},
  {slug:'k12-teacher',id:'try-teacher',label:'Teacher at Booker T. Washington High, Atlanta',workplace:school.name,title:'Public school teacher',site:school},
  {slug:'electrician',id:'try-electrician',label:'Electrician at Taylor Electric, Chicago',workplace:'Taylor Electric Company, Chicago, IL',title:'Electrician'},
];

export const readingPreviewSlugs=['registered-nurse','electrician'];
export function examplePath(slug) {
  return (readingPreviewSlugs.includes(slug) ? '/preview/p/' : '/p/') + slug + '/?example=1#path-preview';
}
