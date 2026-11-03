// These are discovery terms. A reader confirms a profession before seeing its data.
const titles = {
  physician: ['family physician', 'family medicine physician', 'family practice physician', 'primary care physician', 'attending physician', 'resident physician', 'emergency physician', 'hospitalist', 'pediatrician', 'paediatrician', 'internist', 'cardiologist', 'dermatologist', 'anesthesiologist', 'psychiatrist', 'neurologist', 'obstetrician', 'gynecologist', 'surgeon', 'orthopedic surgeon'],
  lawyer: ['legal counsel', 'general counsel', 'corporate counsel', 'in-house counsel', 'trial attorney', 'district attorney', 'assistant district attorney', 'public defender', 'litigation attorney'],
  engineer: ['structural engineer', 'environmental engineer', 'industrial engineer', 'aerospace engineer', 'biomedical engineer', 'manufacturing engineer', 'petroleum engineer', 'materials engineer', 'nuclear engineer'],
  dentist: ['pediatric dentist', 'orthodontist', 'endodontist', 'periodontist', 'oral surgeon'],
  pharmacist: ['staff pharmacist', 'clinical pharmacist', 'retail pharmacist', 'pharmacist in charge'],
  'registered-nurse': ['registered professional nurse', 'staff nurse', 'charge nurse', 'travel nurse', 'bedside nurse'],
  'k12-teacher': ['public school teacher', 'public school educator', 'classroom teacher', 'middle school teacher', 'elementary school teacher', 'secondary school teacher', 'K-12 educator'],
  professor: ['assistant professor', 'associate professor', 'adjunct professor', 'adjunct faculty', 'clinical professor', 'professor of practice', 'teaching professor'],
  journalist: ['journalist', 'staff reporter', 'news reporter', 'investigative reporter', 'investigative journalist', 'sports reporter', 'political reporter', 'columnist'],
  'nonprofit-executive': ['nonprofit executive director', 'charity executive director', 'foundation executive director'],
  'elected-official': ['council member', 'city council member', 'state representative', 'state senator', 'member of congress'],
  pastor: ['senior pastor', 'associate pastor', 'assistant pastor', 'youth pastor', 'lead pastor'],
  'military-officer': ['air force officer', 'marine officer', 'commissioned military officer', 'navy officer'],
  'police-officer': ['patrol officer', 'police detective', 'police sergeant', 'police lieutenant', 'deputy sheriff'],
  electrician: ['journeyworker electrician', 'journeyman electrician', 'master electrician', 'apprentice electrician', 'licensed electrician'],
  'software-engineer': ['SWE', 'SDE', 'software development engineer', 'computer programmer', 'web developer', 'backend engineer', 'back end engineer', 'frontend engineer', 'front end engineer', 'full stack engineer', 'full stack developer', 'backend developer', 'frontend developer', 'mobile developer', 'application software developer', 'iOS developer', 'Android developer', 'platform software engineer'],
  'corporate-executive': ['corporate chief executive officer', 'corporate CEO', 'company chief executive'],
  entrepreneur: ['cofounder', 'co-founder', 'startup founder', 'company founder', 'owner operator', 'business proprietor'],
  'pro-athlete': ['pro athlete', 'NFL player', 'NBA player', 'professional football player', 'professional basketball player'],
  musician: ['vocalist', 'guitarist', 'pianist', 'drummer', 'saxophonist', 'violinist', 'professional musician'],
};

// Return choices for a title shared by genuinely different professions. An
// employer's name would not establish which occupation its employee holds.
const ambiguous = {
  officer: [['military-officer','A commissioned role in the armed forces'],['police-officer','A sworn role in law enforcement'],['corporate-executive','An officer of a corporation']],
  ceo: [['corporate-executive','Chief executive of a business'],['nonprofit-executive','Chief executive of a nonprofit']],
  'chief executive': [['corporate-executive','Chief executive of a business'],['nonprofit-executive','Chief executive of a nonprofit']],
  'chief executive officer': [['corporate-executive','Chief executive of a business'],['nonprofit-executive','Chief executive of a nonprofit']],
  'executive director': [['nonprofit-executive','Executive leadership in a nonprofit'],['corporate-executive','Executive leadership in a business']],
};

const specializations = {
  'registered-nurse': ['critical care','intensive care','ICU','NICU','PICU','ER','ED','emergency department','emergency room','medical surgical','med surg','oncology','pediatric','pediatrics','labor and delivery','perioperative','operating room','telemetry','dialysis','RN BSN','BSN'],
  'k12-teacher': ['public school', 'math','mathematics','science','english','biology','history','social studies','special education','physical education','art','music','middle school','high school','elementary school'],
  professor: ['of biology','of engineering','of history','of mathematics','of medicine','of law','of english','of computer science','of physics','of chemistry'],
  'software-engineer': ['backend','back end','frontend','front end','full stack','payments','platform','infrastructure','applications','mobile','iOS','Android','developer tools','distributed systems'],
  lawyer: ['litigation','employment','immigration','civil rights','tax','patent','family law','associate'],
  dentist: ['pediatric','general'], pharmacist: ['clinical','retail','hospital'],
};
const rank = /^(?:(?:senior|sr|junior|jr|lead|principal|staff|associate|adjunct|licensed|certified|board certified) )+/;
const level = / (?:i{1,3}|iv|[1-5])$/;

export function normalizeJobTitle(value) {
  return String(value ?? '').normalize('NFKD').replace(/\p{M}/gu, '')
    .toLowerCase().replace(/[’']/g, '').replace(/\./g, '').replace(/&/g,' and ')
    .replace(/[^a-z0-9]+/g,' ').trim();
}

export function jobTerms(profession) {
  return [profession.name,...(profession.aliases||[]),...(titles[profession.slug]||[])];
}

function findOne(title, professions) {
  const raw = normalizeJobTitle(title);
  if (!raw) return [];
  const base = raw.replace(rank,'').replace(level,'');
  const choices = ambiguous[raw] || ambiguous[base];
  if (Array.isArray(choices)) {
    return choices.flatMap(([slug,reason])=>{
      const profession=professions.find(p=>p.slug===slug);
      return profession ? [{slug,name:profession.name,reason}] : [];
    });
  }

  const matches = [];
  for (const p of professions) {
    const terms = jobTerms(p);
    const known = new Map(terms.map(t=>[normalizeJobTitle(t),t]));
    let term = known.get(raw) || known.get(base);
    if (!term) {
      for (const qualifier of specializations[p.slug] || []) {
        const q = normalizeJobTitle(qualifier);
        const stem = base.startsWith(q+' ') ? base.slice(q.length+1) :
          base.endsWith(' '+q) ? base.slice(0,-q.length-1) : '';
        term = known.get(stem);
        if (term) break;
      }
    }
    if (term) matches.push({slug:p.slug,name:p.name,reason:'Matches the title “'+term+'”.'});
  }
  return matches;
}

export function matchJobTitle(title, professions) {
  if (typeof title !== 'string' || !Array.isArray(professions)) return [];
  // People sometimes type "role at employer" into the title field. Match only the role.
  const job = title.trim().split(/\s+at\s+/i,1)[0];
  const direct = findOne(job,professions);
  if (direct.length) return direct;
  // Only split explicit dual titles when each half independently resolves.
  const parts = job.split(/\s*(?:\/|&|\band\b)\s*/i).filter(Boolean);
  if (parts.length < 2 || parts.length > 3) return [];
  const groups = parts.map(part=>findOne(part,professions));
  if (groups.some(group=>!group.length)) return [];
  return [...new Map(groups.flat().map(m=>[m.slug,m])).values()];
}
