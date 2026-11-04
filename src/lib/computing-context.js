import workplaceRecords from '../../data/workplace-links.json' with {type:'json'};
import {findWorkplaceLinks} from './trace-context.js';

// Each source describes the selected occupation or a particular employer’s
// practice. The historical Whirlwind record is independent of these sources.
const roleRecords = {
  sre: {
    heading: 'Marian Croak · reliability engineering at Google',
    detail: 'In a 2020 interview, Croak described leading Google’s reliability-engineering teams. This records Black technical leadership in the specialty; it does not establish any reader’s hiring route.',
    publisher: 'USPTO · Interview with Marian Croak',
    url: 'https://www.uspto.gov/learning-and-resources/journeys-innovation/audio-stories/positively-connected',
  },
  devops: {
    heading: 'A DevOps practice today',
    detail: 'DORA documents developers and operations staff building a shared process to deploy software. They automate steps such as configuring the environment, releasing the software, and checking that it works.',
    publisher: 'DORA · Deployment automation',
    url: 'https://dora.dev/capabilities/deployment-automation/',
  },
  systems: {
    heading: 'Systems administration today',
    detail: 'Systems administrators install and maintain operating systems and servers. They monitor performance, troubleshoot problems, and manage access for users.',
    publisher: 'U.S. Bureau of Labor Statistics · Systems administrators',
    url: 'https://www.bls.gov/ooh/computer-and-information-technology/network-and-computer-systems-administrators.htm',
  },
  database: {
    heading: 'Database administration today',
    detail: 'Database administrators keep data available to authorized users, make backups, and restore data after a failure.',
    publisher: 'U.S. Bureau of Labor Statistics · Database administrators',
    url: 'https://www.bls.gov/ooh/computer-and-information-technology/database-administrators.htm',
  },
  support: {
    heading: 'Computer support today',
    detail: 'Support specialists help people diagnose problems with computers. Some work directly with users, while others troubleshoot networks.',
    publisher: 'U.S. Bureau of Labor Statistics · Computer support',
    url: 'https://www.bls.gov/ooh/computer-and-information-technology/computer-support-specialists.htm',
  },
  networkSupport: {
    heading: 'Network support today',
    detail: 'Network support specialists test connections, look for the cause of outages, and maintain networks so people can keep using them.',
    publisher: 'U.S. Bureau of Labor Statistics · Computer network support',
    url: 'https://www.bls.gov/ooh/computer-and-information-technology/computer-support-specialists.htm#tab-2',
  },
  security: {
    heading: 'A role in digital security',
    detail: 'Information security analysts watch for breaches and investigate incidents affecting computer systems. Security teams use a range of job titles for this work.',
    publisher: 'U.S. Bureau of Labor Statistics · Information security analysts',
    url: 'https://www.bls.gov/ooh/computer-and-information-technology/information-security-analysts.htm',
  },
  software: {
    heading: 'Software development today',
    detail: 'Software developers design applications and systems. Their work can include gathering requirements, planning changes, and checking that software meets its users’ needs.',
    publisher: 'O*NET · Software developers',
    url: 'https://www.onetonline.org/link/summary/15-1252.00',
  },
};

// Only these published starting points travel in a link. A neighboring
// occupation gets an invitation to explore, never an implied promotion path.
export function careerGuideFor(resolution) {
  if (!resolution?.computing) return null;
  const systems = '/career-map/?work=systems#compare-moves';
  switch (resolution.contextKey) {
    case 'support':
      return {href:'/career-map/?work=support#compare-moves', label:'Compare next moves from user support'};
    case 'systems':
      return {href:systems, label:'Compare next moves from systems and networks'};
    case 'networkSupport':
    case 'sre':
    case 'devops':
      return {href:systems, label:'Explore related systems and network roles'};
    default:
      return {href:'/career-map/', label:'Explore more careers'};
  }
}

export function computingWorkplaceRecord(context) {
  return findWorkplaceLinks(context.employer,'software-engineer',workplaceRecords,context.workplaceInfo,
    {related:true,contextKey:context.contextKey,occupationCode:context.occupationCode})[0] || null;
}

export function showComputingContext(panel, context) {
  if (!panel) return;
  panel.hidden = !context?.computing;
  if (panel.hidden) return;

  const role = Object.hasOwn(roleRecords, context.contextKey) ? roleRecords[context.contextKey] : null;
  const current = panel.querySelector('[data-computing-role]');
  current.hidden = !role;
  if (role) {
    current.querySelector('[data-role-heading]').textContent = role.heading;
    current.querySelector('[data-role-detail]').textContent = role.detail;
    const source = current.querySelector('[data-role-source]');
    source.textContent = role.publisher + ' ↗';
    source.href = role.url;
  }

  const workplace = context.employer?.trim();
  const record=computingWorkplaceRecord(context);
  panel.querySelector('.record-gap strong').textContent=record?'Where the connection stops':'The open question';
  panel.querySelector('[data-computing-gap]').textContent = record?record.sourceNote:workplace
    ? 'Which people opened this specialty at ' + workplace + '? A training or hiring record from that workplace could connect it to the field history.'
    : 'Who opened this particular specialty to Black workers? Thompson’s account documents computer operations at MIT. A dated training or hiring record could establish the next step.';
}
