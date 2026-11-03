import {projectTitle} from './project-work.js';
import {matchJobTitle, normalizeJobTitle} from './job-match.js';

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
  const byTitle = new Map();
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
  for (const [index, [, name]] of directory.occupations.entries()) add(name, [index]);
  directoryIndices.set(directory, byTitle);
  return byTitle;
}

function occupationsFor(key, directory) {
  if (!Array.isArray(directory?.entries) || !Array.isArray(directory?.occupations)) return [];
  const raw = titleIndex(directory).get(key) || [];
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
  const slug = relatedFields[record.code];
  const published = slug && professions.some(p=>p.slug===slug);
  const contextKey = computingOccupations[record.code] || (record.code.startsWith('15-12') ? 'computing' : null);
  return {kind:published ? 'related' : 'recognized', title, occupation:record.name,
    occupations:[record], ...(published ? {slug} : {}),
    ...(contextKey ? {computing:true, contextKey} : {})};
}

export function resolveTitle(input, professions, directory = null) {
  const title = typeof input === 'string' ? input.trim() : '';
  const role = title.split(/\s+at\s+/i, 1)[0];
  const raw = normalizeJobTitle(role);
  const key = raw.replace(/^(?:(?:senior|sr|junior|jr|lead|principal|staff) )+/, '')
    .replace(/ (?:i{1,3}|iv|[1-5])$/, '');
  const common = projectTitle(title,key) || commonResolution(title, key, professions);
  if (common) return common;
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
  if (candidates.length > 1) return clarify(title,title,'Which occupation fits your work?',candidates.map(record =>
    alternative(record.name, fromOccupation(title,record,professions))));
  return {kind:'unknown',title};
}
