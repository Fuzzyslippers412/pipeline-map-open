import {jobTerms, normalizeJobTitle} from './job-match.js';
import {resolveTitle, commonComputingTitles} from './title-resolver.js';

// Some profession-directory aliases are academic fields, credentials or organizations.
// They can find a public card but should not replace the title a person enters.
const fieldOnly = new Set([
  'medicine','law','engineering','dentistry','pharmacy','nursing','registered nursing',
  'nonprofit leadership','software engineering','executive leadership','entrepreneurship',
  'electrical trades','ibew','nfl','nba','jd','dds','dmd','pharmd','self employed','police'
]);
const commonTitles = [
  'Pharmacy technician','Medical assistant','Physician assistant','Security officer',
  'Warehouse associate','Bench technician','Administrative assistant','Shift supervisor',
  'Operations analyst','HR specialist','Customer service representative','Executive director',
  'Chief executive officer','Officer','Clinical research coordinator','PM','Project manager','Product manager','Program manager',
];
const specialties = [
  ['ICU registered nurse','ICU nurse'], ['Intensive care registered nurse','intensive care nurse'],
  ['NICU registered nurse','NICU nurse'], ['Emergency room registered nurse','emergency room nurse'],
  ['Operating room registered nurse','operating room nurse'], ['Oncology registered nurse','oncology nurse'],
];
const computingAliases = {
  'Systems Administrator':['system admin','sys admin','sysadmin'],
  'Site Reliability Engineer':['sre'],
  'IT':['regular it','information technology'],
  'IT Support Specialist':['it help desk','help desk','it support'],
  'DevOps Engineer':['dev ops eng','development operations engineer'],
};
const EMPTY = [];
let lastIndex;

function displayTerm(term) {
  return /^[a-z][A-Z]/.test(term) ? term : term[0].toUpperCase()+term.slice(1);
}

function prepare(professions, officialTitles) {
  const seen = new Set();
  const entries = [];
  function add(title, extraKeys=[]) {
    if(typeof title!=='string' || !title.trim()) return;
    const key=normalizeJobTitle(title);
    if(key.length<2 || seen.has(key)) return;
    seen.add(key);
    entries.push({title,key,words:key.split(' '),extraKeys:extraKeys.map(normalizeJobTitle)});
  }
  for(const [title,alias] of specialties) add(title,[alias]);
  for(const title of commonComputingTitles) add(title,computingAliases[title]);
  for(const title of commonTitles) add(title);
  for(const p of professions){
    for(const term of jobTerms(p)){
      if(typeof term==='string' && term && !fieldOnly.has(normalizeJobTitle(term)) && !term.includes('/')) add(displayTerm(term));
    }
  }
  if (Array.isArray(officialTitles)) {
    for(const title of officialTitles) add(title);
  } else {
    for(const row of officialTitles.entries) add(row[0]);
    for(const [,occupation] of officialTitles.occupations) add(occupation);
  }
  return entries;
}

function matchRank(entry,query,parts) {
  if(entry.key===query) return 0;
  // A two-letter abbreviation should not match arbitrary words such as Italian.
  if(query==='it' && !entry.words.includes('it')) return -1;
  if(entry.key.startsWith(query) || entry.extraKeys.some(key=>key.startsWith(query))) return 1;
  // Support partial words in their entered order, including "icu nur" and "clinical coordinator".
  let next=0;
  for(let i=0;i<entry.words.length;i++){
    if(entry.words[i].startsWith(parts[next])){
      next++;
      if(next===parts.length) return entry.words[0].startsWith(parts[0]) ? 2 : 3;
    }
  }
  return -1;
}

// Older callers may supply a flat title list. New clients pass the occupation directory.
export function suggestJobTitles(value, professions, supplementalTitles=EMPTY, limit=5) {
  const query=normalizeJobTitle(value);
  if(query.length<2 || !Array.isArray(professions)) return [];
  const count=Math.max(0,Math.min(12,Math.floor(limit)));
  if(!count) return [];
  supplementalTitles ||= EMPTY;
  if (!Array.isArray(supplementalTitles) && !Array.isArray(supplementalTitles.entries)) return [];
  if(!lastIndex || lastIndex.professions!==professions || lastIndex.supplementalTitles!==supplementalTitles){
    lastIndex={professions,supplementalTitles,entries:prepare(professions,supplementalTitles)};
  }
  // Keep a bounded number per rank, maintaining source order within a rank.
  // Common and reported terms precede the larger alternate-title vocabulary.
  const buckets=[[],[],[],[]];
  const parts=query.split(' ');
  for(const entry of lastIndex.entries){
    const rank=matchRank(entry,query,parts);
    if(rank!==-1 && buckets[rank].length<count) buckets[rank].push(entry.title);
  }
  const candidates = buckets.flat().slice(0,count);
  if (!candidates.length && resolveTitle(value,professions,supplementalTitles).kind!=='unknown') {
    candidates.push(value.trim());
  }
  return candidates.map(title=>{
    const result=resolveTitle(title,professions,supplementalTitles);
    const labels={
      exact:'Profession: '+result.occupation,
      related:'Related field history available',
      choices:'Several possible professions',
      recognized:'Occupation recognized · workplace research available',
      unknown:'Workplace research available',
    };
    return {title,label:title,subtitle:result.projectSector?'Black project management history available':labels[result.kind],slug:result.kind==='exact' ? result.slug : null};
  });
}
