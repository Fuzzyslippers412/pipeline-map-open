import catalog from '../../data/catalog.json' with { type: 'json' };
export const { professions, sources, series, roles } = catalog;
export const labels = {hbcu:'HBCUs',military:'Military',black_church:'Black church',market:'Market',union_or_trade:'Unions & trades',civil_rights_law:'Civil rights law',foundation_nonprofit:'Foundations & nonprofits',university_dei:'University admissions & DEI',legacy_media:'Legacy media',licensing_board:'Licensing boards',electorate:'Electorate',nation_of_islam:'Nation of Islam',fraternal_order:'Fraternal orders',other:'Other institutions'};
export const descriptions = {hbcu:'Historically Black colleges and universities.',military:'Armed services and their training and promotion systems.',black_church:'Black congregations and denominations.',market:'Employers, customers and commercial demand.',union_or_trade:'Unions, apprenticeship sponsors and trade associations.',civil_rights_law:'Civil rights legislation and its enforcement.',foundation_nonprofit:'Foundations, nonprofits and their boards.',university_dei:'University selection and access programs. The evidence distinguishes who advises from who admits.',legacy_media:'Established publishers, newsrooms and broadcasters.',licensing_board:'Boards with statutory authority to license practitioners.',electorate:'Voters and electoral institutions.',nation_of_islam:'Economic and educational institutions of the Nation of Islam.',fraternal_order:'Membership organizations and fraternal orders.',other:'An institution outside the listed categories.'};
export const groups={black_male:'Black male',black_female:'Black female',all_male:'All male',all_female:'All female'};
export const measures={share_of_profession:'Workforce share',share_of_black:'Share of Black workers',entrants:'Entry into training',count:'Count'};
export const isPct = unit => ['%','percent','percentage','pct'].includes(String(unit).toLowerCase());
export const amount = p => Number(p.value).toLocaleString('en-US',{minimumFractionDigits:isPct(p.unit)?1:0,maximumFractionDigits:isPct(p.unit)?1:0})+(isPct(p.unit)?'%':'');
export const src = id => sources.find(s=>s.id===id);
export const dataFor = slug => series.filter(r=>r.profession_id===slug);
export const idFor = slug => String(professions.findIndex(p=>p.slug===slug)+1).padStart(2,'0');
export const roleFor = p => p.researchNote || 'Field history is not proof of an individual hiring route.';
export const labelList = values => values.map(v=>labels[v]).join(' + ');
export const percentRows = r => ['black_male','black_female'].includes(r.group);
export const variants = rows => {
 const output=new Map();
 for(const row of rows.filter(percentRows)){
  // Families that share a denominator and universe can display successive source years together.
  const key=[row.measure,row.unit,row.family||row.dataset||row.series_family||row.series_id.replace(/black[_-](male|female)/ig,'black').replace(/(?:19|20)\d\d/g,'YEAR')].join('|');
  if(!output.has(key))output.set(key,{key,measure:row.measure,unit:row.unit,title:row.measure_label||measures[row.measure],rows:[]});
  output.get(key).rows.push(row);
 }
 const priority=v=>['acs-employed','acs-school-teachers'].includes(v.rows[0].family)?0:v.rows[0].family==='ipums-cps-employed'?1:v.measure==='entrants'?2:3;
 return [...output.values()].sort((a,b)=>priority(a)-priority(b));
};
