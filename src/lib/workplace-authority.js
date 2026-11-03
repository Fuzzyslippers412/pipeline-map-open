// Match on the reviewed workplace row returned by findWorkplaceLinks. A district,
// union, jobsite, parent organization or similarly named school has its own scope.
export const workplaceAuthorities = [
  {
    profession: 'k12-teacher',
    siteId: 'nces-school-130012004174',
    scopeLabel: 'School and district',
    place: 'Booker T. Washington High School, Atlanta',
    checked: '2026-11-03',
    entries: [
      {
        role: 'School budget and planning',
        actor: 'Booker T. Washington High School GO Team',
        decision: 'Parents and instructional staff on the GO Team help school leaders shape the budget and strategic plan. The school publishes the team’s members and meetings.',
        source: {
          title: 'Atlanta Public Schools · GO Team duties',
          url: 'https://www.atlantapublicschools.us/about/departments/office-of-strategy/go-teams'
        },
        localSource: {
          title: 'Booker T. Washington High School · Members and meetings',
          url: 'https://washington.atlantapublicschools.us/community/go-team'
        }
      },
      {
        role: 'Teacher recruitment',
        actor: 'Atlanta Public Schools',
        decision: 'The district recruits teachers and accepts applications for its teaching positions through its jobs portal.',
        source: {
          title: 'Atlanta Public Schools · Teaching jobs',
          url: 'https://www.atlantapublicschools.us/about/departments/human-resources/careers/teach'
        }
      }
    ],
    note: 'The school budget and district application process leave open who selected a particular teacher.'
  },
  {
    profession: 'registered-nurse',
    workplace: 'Howard University Hospital',
    scopeLabel: 'Hospital and licensing board',
    place: 'Howard University Hospital, Washington, D.C.',
    checked: '2026-11-03',
    entries: [
      {
        role: 'Nursing license',
        actor: 'D.C. Board of Nursing',
        decision: 'The board licenses registered nurses and regulates nursing practice in the District. It also approves nursing education programs.',
        source: {
          title: 'DC Health · Board of Nursing',
          url: 'https://dchealth.dc.gov/bon'
        }
      },
      {
        role: 'Hospital hiring',
        actor: 'Howard University Hospital',
        decision: 'The hospital recruits registered nurses for specific units and shifts through its own careers site.',
        source: {
          title: 'Howard University Hospital · Career openings',
          url: 'https://www.huhealthcarecareers.com/'
        }
      }
    ],
    note: 'A license permits practice. These records leave open which applicant the hospital hired.'
  },
  {
    profession: 'electrician',
    workplace: 'Taylor Electric Company, Chicago, IL',
    scopeLabel: 'Employer and training program',
    place: 'Taylor Electric Company, Chicago',
    checked: '2026-11-03',
    entries: [
      {
        role: 'Apprentice selection',
        actor: 'IBEW-NECA Technical Institute',
        decision: 'The Alsip program considers an aptitude test and an experience form when choosing apprentices. After the first year, its director assigns apprentices to union contractors.',
        source: {
          title: 'IN-Tech · Selection and contractor assignments',
          url: 'https://ejatt.com/about-in-tech/faqs/'
        }
      },
      {
        role: 'Electrical hiring',
        actor: 'Taylor Electric Company',
        decision: 'Taylor asks electricians who want to work for the company to be union members and accepts résumés directly.',
        source: {
          title: 'Taylor Electric · Electrician hiring requirements',
          url: 'https://taylorelectricco.com/about/careers/'
        }
      }
    ],
    note: 'These sources leave open who worked on the Soldier Field crew or how they joined it.'
  }
];

export function findWorkplaceAuthority(context, matches = []) {
  if (!context?.employer || context.related) return null;
  return workplaceAuthorities.find(record =>
    record.profession === context.profession &&
    matches.some(match => record.siteId
      ? match.site?.id === record.siteId
      : match.workplace === record.workplace)
  ) ?? null;
}


export function authorityReadingHref(record, publicExample) {
  if (!record || !['registered-nurse', 'electrician'].includes(record.profession)) return null;
  const sample = publicExample ? '?example=1' : '';
  return '/preview/p/' + record.profession + '/' + sample + '#who-decides';
}
