import {normalizeEmployerText} from './employer-key.js';

// These are independent accounts of access. Dates label the documented event.
export const pmRoleRecords = {
  'product-manager': {
    name:'Product manager', intro:'Product managers help decide which customer problems a team will solve and what it will build next.',
    first:{
      person:'Kayiita Johnson', date:'2020', place:'PM While Black',
      story:'While working as a product manager at Google Nest, Johnson started PM While Black to make information about entering product management easier for Black candidates to find.',
      opened:'In his interview, Johnson describes senior product managers offering mentorship and employers reaching out to include Black professionals in their candidate pools.',
      sources:[['Read Johnson’s interview','https://www.tryexponent.com/blog/pm-while-black-making-product-management-accessible-to-the-black-community']]
    },
    second:{
      person:'Jules Walter, Maryanna Quigless and Brittany Bankston', date:'By February 2023', place:'Black Product Managers',
      story:'Black Product Managers names Walter, Quigless and Bankston as co-founders. In 2023 the organization reported that it had run three cohorts of Level Up, a product management accelerator with industry partners.',
      sources:[['Meet the co-founders','https://www.blackproductmanagers.com/about2'],['Read the organization’s report on Level Up','https://www.globenewswire.com/news-release/2023/02/22/2613657/0/en/New-CEO-of-Black-Product-Managers-Aims-to-Expand-Opportunities-for-Economic-Mobility-and-Improve-Product-Outcomes-in-Tech.html']]
    },
    workplaceNames:['Google Nest'], siteRecord:'Johnson’s interview places him in product management at Google Nest. It does not identify who hired you or assigned your product.',
    gap:'We have no reviewed record linking these initiatives to product hiring or assignments at this workplace.',
    next:'Look for an associate product manager cohort announcement or a product team appointment that names the team, sponsor and selection process.',
    practice:'Pick one user problem. Write down the evidence for it and one feature you would defer to address it.',
    question:'Who chooses product leads here, and what gives someone their first opportunity to own a product decision?'
  },
  'program-manager':{
    name:'Program manager', intro:'Program managers coordinate related work toward an outcome that extends beyond a single project.',
    first:{
      person:'Mary W. Jackson', date:'1979', place:'NASA Langley Research Center',
      story:'Jackson left engineering and accepted a lower grade to become Langley’s Federal Women’s Program Manager. She used the position to advocate for hiring and promotion opportunities for women and minority employees.',
      opened:'NASA documents a Black engineer moving into a role where she could address who got hired and advanced. The record names the program and her responsibility there.',
      sources:[['NASA’s biography of Jackson','https://www.nasa.gov/people/mary-w-jackson-biography/'],['The Federal Women’s Program at Langley','https://www.nasa.gov/image-article/federal-womens-program/']]
    },
    second:{
      person:'Mary McLeod Bethune', date:'1930s', place:'National Youth Administration',
      story:'As a division director, Bethune pressed for Black young people to receive skilled-trades training and help finding work. Her record shows how a federal program leader could change whose needs a training program served.',
      sources:[['National Park Service biography','https://www.nps.gov/people/mary-mcleod-bethune.htm']]
    },
    workplaceNames:['NASA Langley Research Center','Langley Research Center','NASA Langley'],
    siteRecord:'NASA documents Jackson’s program manager appointment at Langley. How your own program is staffed or led still needs a local record.',
    gap:'We have no reviewed record connecting these public programs to program leadership at this workplace.',
    next:'Look for a program charter, annual report or appointment notice that identifies the sponsor, program lead and who assigned that responsibility.',
    practice:'Choose one program outcome. List two teams whose work must come together to achieve it.',
    question:'Who sponsors the program, and who appoints the lead when several teams share responsibility?'
  }
};

export function pmWorkplaceRecord(role,workplace){
  const record=pmRoleRecords[role];
  if(!workplace?.trim())return {label:'Workplace not entered',text:'Add your workplace in the trace to check for a local connection.'};
  const matched=record.workplaceNames.some(name=>normalizeEmployerText(name)===normalizeEmployerText(workplace));
  return {label:(matched?'Documented workplace · ':'Still open at ')+workplace,text:matched?record.siteRecord:record.gap};
}
