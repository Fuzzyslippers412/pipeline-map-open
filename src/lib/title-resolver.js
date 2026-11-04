import {projectTitle} from './project-work.js';
import {matchJobTitle, normalizeJobTitle, jobTerms} from './job-match.js';
import {everydayTitles,everydayOccupation,canonicalTitleForms,spellingSuggestions} from './title-language.js';

let pendingDirectory;
const directoryIndices = new WeakMap();

// Both search fields load one local, versioned asset. Failed loads may be retried.
export function loadTitleDirectory() {
  if (!pendingDirectory) {
    const request = new AbortController();
    const timer = setTimeout(() => request.abort(), 4500);
    pendingDirectory = fetch('/data/job-occupations.json', {credentials:'omit',signal:request.signal})
      .then(async response => {
        if (!response.ok) throw new Error('Occupation directory unavailable');
        const data = await response.json();
        if (data.version !== 1 || !Array.isArray(data.entries) || !Array.isArray(data.occupations))
          throw new Error('Invalid occupation directory');
        return data;
      })
      .catch(() => { pendingDirectory = undefined; return null; })
      .finally(() => clearTimeout(timer));
  }
  return pendingDirectory;
}

function titleIndex(directory) {
  if (directoryIndices.has(directory)) return directoryIndices.get(directory);
  const byTitle = new Map(), canonical = new Map();
  function add(title, indices) {
    const key = normalizeJobTitle(title);
    let matches = byTitle.get(key);
    if (!matches) { matches = new Set(); byTitle.set(key, matches); }
    for (const index of indices) matches.add(index);
  }
  for (const entry of directory.entries) {
    const indices = [];
    for (let i = 1; i < entry.length; i += 2) indices.push(entry[i]);
    add(entry[0], indices);
    // The publisher often supplies both spellings in "title (expanded title)".
    const parens = /^(.+?)\s+\(([^()]+)\)$/.exec(entry[0]);
    if (parens) { add(parens[1], indices); add(parens[2], indices); }
  }
  for (const [index, [, name]] of directory.occupations.entries()) {
    for(const key of canonicalTitleForms(name)){
      if(!canonical.has(key))canonical.set(key,new Set());
      canonical.get(key).add(index);
    }
    add(name, [index]);
  }
  const value={byTitle,canonical};
  directoryIndices.set(directory, value);
  return value;
}

function occupationsFor(key, directory) {
  if (!Array.isArray(directory?.entries) || !Array.isArray(directory?.occupations)) return [];
  const {canonical,byTitle}=titleIndex(directory);
  const raw = canonical.get(key) || byTitle.get(key) || [];
  return [...raw].map(index => {
    const [code, name] = directory.occupations[index];
    return {code, name};
  });
}

// A SOC code can identify a useful profession to explore, independently of
// whether events in that profession cover this exact job or workplace.
const relatedFields = {
  '15-1252.00':'software-engineer',
  '29-1141.00':'registered-nurse',
  '23-1011.00':'lawyer',
  '47-2111.00':'electrician',
  '29-1051.00':'pharmacist',
  '29-1021.00':'dentist',
  '27-3023.00':'journalist',
};

function computingResult(title, occupation, contextKey, slug) {
  return {kind:slug ? 'related' : 'recognized', title, occupation,
    computing:true, contextKey, ...(slug ? {slug} : {})};
}
function alternative(label, result) { return {label, result}; }
function clarify(title, occupation, question, choices) {
  return {kind:'choices', title, occupation, question, choices};
}
const software = 'software-engineer';
function itChoices(title) {
  return clarify(title,'Information technology','What do you spend most of your time doing?', [
    alternative('Supporting people with technology', computingResult(title,'IT support','support')),
    alternative('Running systems or networks', computingResult(title,'Systems and network administration','systems')),
    alternative('Building software', computingResult(title,'Software development','software',software)),
    alternative('Securing computer systems', computingResult(title,'Information security','security')),
    alternative('Something else', {kind:'unknown', title}),
  ]);
}
function supportChoices(title) {
  return clarify(title, 'Support', 'What do you help with most often?', [
    alternative('People using computers or software', computingResult(title,'Computer user support','support')),
    alternative('Keeping computer networks working', computingResult(title,'Computer network support','networkSupport')),
    alternative('Customer orders or service questions', {kind:'recognized', title, occupation:'Customer service'}),
    alternative('Something else', {kind:'unknown', title}),
  ]);
}
function adminChoices(title) {
  return clarify(title,'Systems administrator','What do you primarily administer?', [
    alternative('Systems and networks', computingResult(title,'Systems and network administration','systems')),
    alternative('Databases', computingResult(title,'Database administration','database')),
    alternative('Something else', {kind:'unknown', title}),
  ]);
}
function reliabilityChoices(title, acronym) {
  const choices = [
    alternative('Keeping software services reliable', computingResult(title,'Site reliability engineering','sre',software)),
    alternative('Researching computing systems', computingResult(title,'Computing systems research','computing')),
    alternative('Validating products or equipment', {kind:'recognized', title, occupation:'Validation engineering'}),
  ];
  if (acronym) choices.splice(1, 0, alternative('Defining software requirements',
    computingResult(title,'Software requirements engineering','software',software)));
  choices.push(alternative('Something else', {kind:'unknown', title}));
  return clarify(title,acronym ? 'SRE' : 'Site reliability engineer','Which best describes your work?',choices);
}
function securityChoices(title) {
  return clarify(title,'Security engineer','Which kind of security do you work on?', [
    alternative('Securing computer systems', computingResult(title,'Information security engineering','security')),
    alternative('Testing systems for vulnerabilities', computingResult(title,'Penetration testing','security')),
    alternative('Protecting buildings or physical sites', {kind:'recognized', title, occupation:'Physical security'}),
    alternative('Fire protection', {kind:'recognized', title, occupation:'Fire protection engineering'}),
    alternative('Something else', {kind:'unknown', title}),
  ]);
}

// The common tester inputs resolve before the larger directory finishes loading.
// These are editorial navigation labels; occupational links remain in the source data.
export const commonComputingTitles = [
  'DevOps Engineer','Site Reliability Engineer','Systems Administrator','IT','SRE',
  'Security Engineer','Software Requirements Engineer','IT Support Specialist',
  'Network Administrator','Database Administrator','Information Security Engineer',
  'Physical Security Engineer',
];
function commonResolution(title, key, professions) {
  if (/^(?:regular )?(?:it|information technology)$/.test(key)) return itChoices(title);
  if (['support','tech support','technical support'].includes(key)) return supportChoices(title);
  if (/^(?:systems? admin(?:istrator)?|sys ?admins?)$/.test(key)) return adminChoices(title);
  if (/^(?:cloud )?site reliability (?:engineer|eng)$/.test(key) || key === 'sre')
    return reliabilityChoices(title, key === 'sre');
  if (/^security (?:engineer|eng)$/.test(key)) return securityChoices(title);
  if (/^(?:dev ?ops|development (?:and )?operations)(?: engineer| eng| developer)?$/.test(key))
    return computingResult(title,'DevOps engineer','devops',software);
  if (/^software requirements engineer(?: sre)?$/.test(key))
    return computingResult(title,'Software requirements engineer','software',software);
  if (/^(?:software|soft) eng$/.test(key) && professions.some(p=>p.slug===software))
    return {kind:'exact',title,slug:software,occupation:'Software engineer'};
  if (/^(?:network(?: and (?:computer )?systems)?|computer systems) admin(?:istrator)?$/.test(key))
    return computingResult(title,'Systems and network administration','systems');
  if (/^(?:database admin(?:istrator)?|dba)$/.test(key))
    return computingResult(title,'Database administration','database');
  if (/^(?:it support(?: specialist| technician)?|(?:it )?help ?desk(?: technician| specialist| analyst| associate| tech)?|desktop support|computer user support specialist)$/.test(key))
    return computingResult(title,'IT support','support');
  if (/^(?:information security|cybersecurity|cyber security|it security) (?:analyst|engineer|eng)$/.test(key))
    return computingResult(title,'Information security','security');
  if (key === 'physical security engineer') return {kind:'recognized',title,occupation:'Physical security engineering'};
  return null;
}
const computingOccupations = {
  '11-3021.00':'computing', '15-1212.00':'security',
  '15-1231.00':'networkSupport', '15-1232.00':'support',
  '15-1242.00':'database', '15-1244.00':'systems',
  '15-1252.00':'software', '15-1299.05':'security',
};
function fromOccupation(title, record, professions) {
  const agriculture=/^(?:11-9013|17-2021|19-1013|19-4012|25-1041|25-9021|45-20)/.test(record.code);
  // Offer the published field without treating every specialty as the same
  // history. In particular, 29-129x includes other licensed health professions.
  const broadField=/^25-1/.test(record.code)?'professor':
    /^29-12[124]/.test(record.code)?'physician':/^17-2/.test(record.code)?'engineer':null;
  const slug = agriculture ? 'agriculture' : relatedFields[record.code] || broadField;
  const published = slug && professions.some(p=>p.slug===slug);
  const contextKey = computingOccupations[record.code] || (record.code.startsWith('15-12') ? 'computing' : null);
  return {kind:published ? 'related' : 'recognized', title, occupation:record.name,
    occupations:[record], ...(published ? {slug} : {}),
    ...(contextKey ? {computing:true, contextKey} : {})};
}

function dutiesResolution(title,key,professions){
  const governor=professions.find(p=>p.slug==='governor');
  const state='alabama|alaska|arizona|arkansas|california|colorado|connecticut|delaware|florida|georgia|hawaii|idaho|illinois|indiana|iowa|kansas|kentucky|louisiana|maine|maryland|massachusetts|michigan|minnesota|mississippi|missouri|montana|nebraska|nevada|new hampshire|new jersey|new mexico|new york|north carolina|north dakota|ohio|oklahoma|oregon|pennsylvania|rhode island|south carolina|south dakota|tennessee|texas|utah|vermont|virginia|washington|west virginia|wisconsin|wyoming';
  if(governor&&(new RegExp('^(?:'+state+') governor$').test(key)||new RegExp('^governor (?:of )?(?:'+state+')$').test(key)))return {kind:'exact',title,occupation:'Governor',slug:'governor'};
  if(['politics','political work','government'].includes(key))return clarify(title,'Politics and public service','What kind of public work do you mean?',[
    ...(governor?[alternative('State governor',{kind:'exact',title,occupation:'Governor',slug:'governor'})]:[]),
    alternative('Another elected office',{kind:'exact',title,occupation:'Elected official',slug:'elected-official'}),
    alternative('Campaign work or public-service staff',{kind:'unknown',title}),
    alternative('Use my wording',{kind:'unknown',title})
  ]);
  const option=(label,code,name)=>alternative(label,fromOccupation(title,{code,name},professions));
  const other=alternative('Use my wording',{kind:'unknown',title});
  const groups={
    'case manager':['What does your case management involve?',[
      option('Coordinating care for patients','21-1022.00','Healthcare Social Workers'),
      option('Helping people access social services','21-1093.00','Social and Human Service Assistants'),
      option('Insurance claims','13-1031.00','Claims Adjusters, Examiners, and Investigators')]],
    'data analyst':['What do you mainly analyze?',[
      option('Business performance and reporting','15-2051.01','Business Intelligence Analysts'),
      option('Statistical models and data science','15-2051.00','Data Scientists'),
      option('Research surveys and responses','19-3022.00','Survey Researchers')]],
    'warehouse associate':['What do you mainly do in the warehouse?',[
      option('Pick orders and stock goods','53-7065.00','Stockers and Order Fillers'),
      option('Move or load freight','53-7062.00','Laborers and Freight, Stock, and Material Movers, Hand'),
      option('Operate a forklift','53-7051.00','Industrial Truck and Tractor Operators')]],
    'truck driver':['What kind of vehicle do you drive?',[
      option('Heavy trucks or tractor-trailers','53-3032.00','Heavy and Tractor-Trailer Truck Drivers'),
      option('Delivery vans or light trucks','53-3033.00','Light Truck Drivers'),
      option('Refuse or recycling vehicles','53-7081.00','Refuse and Recyclable Material Collectors')]],
    'postal worker':['What do you do at the post office?',[
      option('Deliver mail','43-5052.00','Postal Service Mail Carriers'),
      option('Serve customers at the counter','43-5051.00','Postal Service Clerks'),
      option('Sort, process or handle mail','43-5053.00','Postal Service Mail Sorters, Processors, and Processing Machine Operators')]],
    'patient care technician':['Which work best describes your role?',[
      option('Assist patients with day-to-day care','31-1131.00','Nursing Assistants'),
      option('Move patients and equipment','31-1132.00','Orderlies'),
      option('Help patients navigate services','29-2099.08','Patient Representatives')]],
    'farmworker':['Which kind of agricultural work do you do?',[
      option('Grow or harvest crops','45-2092.00','Farmworkers and Laborers, Crop, Nursery, and Greenhouse'),
      option('Care for farm animals','45-2093.00','Farmworkers, Farm, Ranch, and Aquacultural Animals'),
      option('Operate farm equipment','45-2091.00','Agricultural Equipment Operators')]],
  };
  const aliases={'case mgr':'case manager','warehouse worker':'warehouse associate','patient care tech':'patient care technician','pct':'patient care technician','farm worker':'farmworker','agricultural worker':'farmworker','agriculture worker':'farmworker'};
  const group=groups[aliases[key]||key];
  return group ? clarify(title,title,group[0],[...group[1],other]) : null;
}

function boundedChoices(title,records,professions){
  const options=records.slice(0,3).map(record=>alternative(record.name,fromOccupation(title,record,professions)));
  if(records.length>3)options.push(alternative('More kinds of work',boundedChoices(title,records.slice(3),professions)));
  options.push(alternative('Use my wording',{kind:'unknown',title}));
  return clarify(title,title,'Which occupation fits your work?',options);
}
export function correctionTitles(input,professions,directory){
 const candidates=[...professions.flatMap(jobTerms),...everydayTitles.flatMap(([title,,,aliases])=>[title,...aliases]),...(directory?.occupations||[]).map(([,name])=>canonicalTitleForms(name).at(-1))];
 return spellingSuggestions(input,candidates);
}

export function resolveTitle(input, professions, directory = null, allowCorrection = true) {
  const title = typeof input === 'string' ? input.trim() : '';
  const role = title.split(/\s+at\s+/i, 1)[0];
  const raw = normalizeJobTitle(role);
  const key = raw.replace(/^(?:(?:senior|sr|junior|jr|lead|principal|staff) )+/, '')
    .replace(/ (?:i{1,3}|iv|[1-5])$/, '');
  const common = projectTitle(title,key) || commonResolution(title, key, professions) || dutiesResolution(title,key,professions);
  if (common) return common;
  const everyday=everydayOccupation(key);
  if(everyday)return fromOccupation(title,everyday,professions);
  const matches = matchJobTitle(title, professions);
  if (matches.length === 1) return {kind:'exact', title, slug:matches[0].slug, occupation:matches[0].name};
  if (matches.length > 1) return clarify(title, title, 'Which path fits your work?', matches.map(match =>
    alternative(match.name, {kind:'exact', title, slug:match.slug, occupation:match.name})));
  // "at" can belong to the occupation itself, as in "Sergeant at Arms".
  const wholeTitleRecords = role === title ? [] : occupationsFor(normalizeJobTitle(title), directory);
  const records = wholeTitleRecords.length ? wholeTitleRecords : occupationsFor(raw, directory);
  const expanded = /^(.+?)\s+\([^()]+\)$/.exec(role);
  if (expanded && records.length) {
    const officialSpelling = commonResolution(title, normalizeJobTitle(expanded[1]), professions);
    if (officialSpelling) return officialSpelling;
  }
  const candidates = records.length || raw===key ? records : occupationsFor(key, directory);
  if (candidates.length === 1) return fromOccupation(title,candidates[0],professions);
  if (candidates.length > 1) return boundedChoices(title,candidates,professions);
  if(allowCorrection){
    const corrections=correctionTitles(role,professions,directory).map(spelling=>({spelling,result:resolveTitle(spelling,professions,directory,false)})).filter(row=>row.result.kind!=='unknown');
    if(corrections.length)return {...clarify(title,title,'Did you mean one of these titles?',[
      ...corrections.map(({spelling,result})=>alternative(spelling,{...result,title})),
      alternative('Use “'+title+'”',{kind:'unknown',title})]),correction:true};
  }
  return {kind:'unknown',title};
}
