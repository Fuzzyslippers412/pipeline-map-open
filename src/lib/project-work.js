// These records describe separate projects and kinds of access.
export const projectStories = {
  general: {
    person:'Asya Watkins', year:'2015', place:'Professional development',
    story:'Watkins founded Women Of Project Management to give Black women in the profession a place to meet peers and develop as leaders.',
    connection:'A professional network can give a worker access to colleagues and learning opportunities. The organization documents that opportunity. It does not track your employer’s hiring decisions.',
    source:'Women Of Project Management · founding account', url:'https://womenofpm.com/about'
  },
  construction:{
    person:'Zena Howard',year:'2009',place:'Washington, DC',
    story:'After the design team won the Smithsonian museum commission, Howard became senior project manager for the National Museum of African American History and Culture. She and lead architect Phil Freelon helped lead more than 30 consultants.',
    connection:'The design team records her project authority. Who appointed her personally, and how another employer assigns that authority, remain open.',
    source:'Perkins&Will · project chronology',url:'https://perkinswill.com/celebrating-nmaahcs-ten-year-anniversary/'
  },
  engineering:{
    person:'Joseph Hunt',year:'Mars Odyssey',place:'NASA Jet Propulsion Laboratory',
    story:'Hunt describes directing the extended mission of NASA’s Mars Odyssey orbiter. He was responsible for coordinating the people and resources needed to meet the mission’s objectives.',
    connection:'NASA records Hunt’s project responsibilities. A reader’s own engineering assignment or promotion requires a separate local record.',
    source:'NASA · interview with Joseph Hunt',url:'https://science.nasa.gov/people/joseph-hunt/'
  },
  community:{
    person:'Bayard Rustin',year:'1963',place:'March on Washington for Jobs and Freedom',
    story:'A. Philip Randolph appointed Rustin deputy director and gave him responsibility for day-to-day planning. Rustin coordinated organizers, travel and marshal training for the march.',
    connection:'The connection to project work today is the planning and coordination. Rustin’s historical title was deputy director.',
    source:'National Park Service · organizing the march',url:'https://www.nps.gov/articles/march-on-washington.htm'
  }
};
export const projectSectors = [
  ['general','Across fields / skip'],['construction','Construction or design'],['engineering','Engineering or aerospace'],
  ['technology','Technology'],['health','Healthcare or research'],['business','Business or operations'],['community','Community programs']
];
export const sectorQuestions = {
  general:'Who assigns project leads and approves the scope? Ask for a project charter or appointment announcement.',
  construction:'Who selects the project lead for this site? Look for a contract award or a project team announcement.',
  engineering:'Who assigned leadership of this project? Look for a mission or project charter.',
  technology:'Who owns delivery and who approves the release? Look for a project charter or team announcement.',
  health:'Who led this hospital or research project? Look for a project charter or an appointment announcement.',
  business:'Who sponsors the project and who controls its budget? Look for a project charter or an appointment record.',
  community:'Who appointed the coordinator and assigned the work? Look for a planning committee record or event program.'
};
export function projectResult(sector='general') {
  return {kind:'recognized', title:'Project manager', occupation:'Project management',projectSector:sector};
}
function roleResult(title,name){
  return {kind:'recognized',title,occupation:name,pmRole:name==='Product manager'?'product-manager':'program-manager'};
}
export function projectTitle(title,key) {
  if(key==='pm') return {kind:'choices',title,occupation:'PM',question:'What does PM mean in your title?',choices:[
    {label:'Project manager',result:projectResult()},
    ...['Product manager','Program manager'].map(name=>({label:name,result:roleResult(title,name)})),
    {label:'Something else',result:{kind:'unknown',title}}
  ]};
  const role=/^(?:(?:associate|technical|group|digital|principal|senior|lead) )*(product|program) (?:manager|mgr)(?: pm)?$/.exec(key);
  if(role)return roleResult(title,role[1]==='product'?'Product manager':'Program manager');
  if(/^(?:project manager(?: pm)?|project mg[r]|project management specialists?)$/.test(key)) return projectResult();
  const sectorPatterns = [
    ['construction',/^(?:(?:commercial )?construction|architectural|civil) (?:project manager|pm)$/],
    ['engineering',/^(?:engineering|aerospace) (?:project manager|pm)$/],
    ['technology',/^(?:it|software|information technology|technology|digital) (?:project manager|pm)(?: information technology project manager)?$/],
    ['health',/^(?:clinical|healthcare|health care|hospital|clinical research) (?:project manager|pm)$/],
    ['community',/^community (?:project manager|pm)$/],['business',/^(?:operations|business) (?:project manager|pm)$/]
  ];
  const sector = sectorPatterns.find(([,pattern])=>pattern.test(key));
  return sector ? projectResult(sector[0]) : / project manager$/.test(key) ? projectResult() : null;
}
