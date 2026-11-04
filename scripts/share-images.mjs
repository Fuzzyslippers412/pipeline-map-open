import fs from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { createRequire } from 'node:module';
import { inflateSync } from 'node:zlib';
import satori from 'satori';
import { Resvg } from '@resvg/resvg-js';
import sharp from 'sharp';
import { professions, sources, series, roleFor, labelList, isPct, variants } from '../src/lib/model.js';
import { singleChart, paperColours as colours, safe } from '../src/lib/plot.js';
import { compareModel } from '../src/lib/compare.js';
import config from '../astro.config.mjs';

const require = createRequire(import.meta.url);
const WIDTH = 1200, HEIGHT = 630;
const palette = { bg:'#f8f5ef', panel:'#eee9df', mint:'#293d80', teal:'#874536', ink:'#202124', muted:'#545354', line:'#cdc6ba' };
const url = route => new URL(route,config.site).href;
const brand = 'Door Notes';
const sourceIndex = new Map(sources.map(s => [s.id,s]));
const data = {professions,series};
const fontDir = await fs.mkdtemp(path.join(tmpdir(),'door-notes-fonts-'));
const mono = 'IBM Plex Mono', serif = 'Newsreader';
const fontSpec = [[mono,'ibm-plex-mono',400],[serif,'newsreader',500]];
const fontFiles = [], satoriFonts = [];
const paperMark = (await fs.readFile('public/mark-paper.svg','utf8')).replace('<svg ', '<svg x="48" y="28" ');
const schoolHistory = JSON.parse(await fs.readFile('data/timeline-health-education.json', 'utf8'));
const workplaceRecords = JSON.parse(await fs.readFile('data/workplace-links.json', 'utf8'));
const teacherOpening = schoolHistory['k12-teacher'][0];
const atlanta = workplaceRecords.find(row => row.site?.id === 'nces-school-130012004174');

// Resvg accepts OpenType files. Reconstruct the SFNT directory of the same bundled
// WOFF fonts used by Satori so the host's installed fonts cannot change the image.
function unwrapWoff(buffer) {
  if (buffer.toString('ascii',0,4) !== 'wOFF') throw Error('Expected a WOFF font');
  const count = buffer.readUInt16BE(12);
  const out = Buffer.alloc(buffer.readUInt32BE(16));
  const selector = Math.floor(Math.log2(count)), search = 16 * 2 ** selector;
  out.writeUInt32BE(buffer.readUInt32BE(4),0);
  out.writeUInt16BE(count,4); out.writeUInt16BE(search,6);
  out.writeUInt16BE(selector,8); out.writeUInt16BE(count * 16-search,10);
  let offset = 12 + count * 16;
  for (let i=0; i<count; i++) {
    const src=44+i*20,dst=12+i*16;
    const start=buffer.readUInt32BE(src+4),packed=buffer.readUInt32BE(src+8),length=buffer.readUInt32BE(src+12);
    const part=buffer.subarray(start,start+packed);
    const body=packed<length?inflateSync(part):part;
    if (body.length!==length) throw Error('Invalid font directory');
    buffer.copy(out,dst,src,src+4);
    out.writeUInt32BE(buffer.readUInt32BE(src+16),dst+4);
    out.writeUInt32BE(offset,dst+8);
    out.writeUInt32BE(length,dst+12);
    body.copy(out,offset);
    offset += (length+3)&~3;
  }
  return out;
}

for (const [name,id,weight] of fontSpec) {
  const woff = await fs.readFile(require.resolve('@fontsource/'+id+'/files/'+id+'-latin-'+weight+'-normal.woff'));
  const file = path.join(fontDir,id+'.ttf');
  await fs.writeFile(file,unwrapWoff(woff)); fontFiles.push(file);
  satoriFonts.push({name,weight,style:'normal',data:woff});
}
const resvgOptions = {font:{loadSystemFonts:false,fontFiles,defaultFontFamily:mono,monospaceFamily:mono,serifFamily:serif}};
const txt = (x,y,body,size=16,fill=palette.ink,face=mono,attrs='') =>
  '<text x="'+x+'" y="'+y+'" fill="'+fill+'" font-size="'+size+'" font-family="'+safe(face===serif?"Newsreader Medium":face)+'" '+attrs+'>'+safe(body)+'</text>';
const line = (x1,y1,x2,y2) => '<path d="M'+x1+' '+y1+'L'+x2+' '+y2+'" stroke="'+palette.line+'"/>';
const wrap = body => '<svg xmlns="http://www.w3.org/2000/svg" width="'+WIDTH+'" height="'+HEIGHT+'" viewBox="0 0 1200 630">'+body+'</svg>';
function nested(svg,x,y,width,height) {
  return svg.replace(/<svg[^>]*>/,tag=>{
    const attrs = tag.slice(4,-1).replace(/\s(?:width|height|x|y)="[^"]*"/g,'');
    const box = attrs.includes('viewBox=')?'':' viewBox="0 0 '+width+' '+height+'"';
    return '<svg x="'+x+'" y="'+y+'" width="'+width+'" height="'+height+'"'+attrs+box+'>';
  });
}
const dateRange = years => {
  const distinct=[...new Set(years)].sort((a,b)=>a-b);
  return distinct.length?(distinct.length===1?String(distinct[0]):distinct[0]+'–'+distinct.at(-1)):'';
};
function words(body,limit) {
  const lines=[]; let current='';
  for (const word of body.split(/\s+/)) {
    if(current&&current.length+1+word.length>limit) { lines.push(current); current=''; }
    current=current?current+' '+word:word;
  }
  if(current) lines.push(current);
  return lines;
}
const contentLines = (body,{x,y,limit,step,size,colour,face=mono}) => words(body,limit).map((part,i)=>txt(x,y+i*step,part,size,colour,face)).join('');
function framing(tag) {
  return '<rect width="1200" height="630" fill="'+palette.bg+'"/>'+paperMark+
    txt(103,57,brand,34,palette.ink,serif)+
    txt(1152,53,tag,16,palette.muted,mono,'text-anchor="end" letter-spacing="1.4"')+
    line(48,88,1152,88);
}
function descriptor(chosen) {
  if (!chosen) return {title:'Series not yet verified',definition:'No verified observations for this selection.',source:'',years:''};
  const sourceLines={
    'acs-employed':['Black alone, any origin · share of all civilian employed people age 16+ in the specified occupation.','U.S. Census Bureau · ACS 1-year PUMS, U.S. person files'],
    'eeo-1990-labor-force':['Black, single reported race · share of the civilian labor force in the specified occupation, including experienced unemployed.','U.S. Census Bureau · 1990 Census EEO CP-S-1-1, Table 2'],
    'aamc-matriculants':['Black only · share of U.S. MD matriculants. A-9 and A-12 use different gender-reporting denominators.','AAMC FACTS · Tables A-9 and A-12, matriculants by race and gender'],
    'eeo-1990-school-teachers':['Black, single reported race · elementary and secondary school teachers in the 1990 civilian labor force.','U.S. Census Bureau · 1990 Census EEO CP-S-1-1, Table 2'],
    'acs-school-teachers':['Black alone · share of civilian employed elementary, middle and secondary teachers. Specified occupation codes exclude separately coded groups.','U.S. Census Bureau · ACS 1-year PUMS, U.S. person files'],
    'dod-officers':['Black active-component commissioned officers as a share of the serving DoD officer corps. Branch coverage and race reporting change over time.','U.S. Department of Defense · Population Representation, Table B-25'],
    'acs-physicians-surgeons':['Black alone · share of employed physicians and surgeons in the combined ACS category.','U.S. Census Bureau · ACS 1-year PUMS, U.S. person files'],
    'acs-music-related':['Black alone · share of workers in the broader historical music occupation category.','U.S. Census Bureau · ACS 1-year PUMS, U.S. person files'],
    'acs-nursing-legacy':['Black alone · share of workers in the broader historical nursing occupation category.','U.S. Census Bureau · ACS 1-year PUMS, U.S. person files'],
    'eeo-1990-school-teachers':['Black, single reported race · elementary and secondary school teachers in the 1990 civilian labor force.','U.S. Census Bureau · 1990 Census EEO CP-S-1-1, Table 2'],
    'acs-school-teachers':['Black alone · share of civilian employed elementary, middle and secondary teachers. Specified occupation codes exclude separately coded groups.','U.S. Census Bureau · ACS 1-year PUMS, U.S. person files'],
    'dod-officers':['Black officers · share of all active-component commissioned officers in the covered services at fiscal year-end.','U.S. Department of Defense · Population Representation, Table B-25, officer corps'],
    'aba-first-year':['Black, Hispanic and multiracial categories separate · share of first-year JD students. Nonresident reporting changes by year.','ABA Standard 509 · JD Enrollment and Ethnicity, JD1'],
  };
  const [definition,source]=sourceLines[chosen.family]||[chosen.rows[0].definition,sourceIndex.get(chosen.rows[0].source_id)?.table_name||''];
  return {title:chosen.label||chosen.rows[0].measure_label,definition,source,years:dateRange(chosen.rows.map(r=>r.year))};
}
function preferCard(rows) {
  const active = variants(rows)[0];
  if (!active) return {traces:[]};
  const kept = active.rows;
  const chosen = {family:kept[0].family,label:active.title,rows:kept,unit:active.unit};
  const traces=['black_male','black_female'].map((g,i)=>({label:i?'Black female':'Black male',colour:colours[i],dash:!!i,rows:kept.filter(r=>r.group===g)}));
  return {chosen,traces};
}
async function cardType(name,role) {
  const el=(type,style,children)=>({type,props:{style,children}});
  const make=async(text,width,height,size)=>satori(el('div',{display:'flex',alignItems:'center',color:palette.ink,width,height,fontFamily:serif,fontSize:size,fontWeight:500,lineHeight:1.1},text),{width,height,fonts:satoriFonts});
  return [await make(name,1080,78,name.length>22?58:70),await make(role,477,110,31)];
}
function panel(x,y,name,value,status) {
  const mark=status==='draft'?'EDITORIAL / PROPOSED':'EDITORIAL';
  return txt(x,y,name.toUpperCase(),15,palette.teal)+txt(x+475,y,mark,13,palette.muted,mono,'text-anchor="end"')+
    contentLines(value,{x,y:y+39,limit:34,step:27,size:25,colour:palette.ink,face:serif});
}
function keyLine(x,y,colour,dashed=false) {
  return '<line x1="'+x+'" x2="'+(x+25)+'" y1="'+y+'" y2="'+y+'" stroke="'+colour+'" stroke-width="3" '+(dashed?'stroke-dasharray="5 3"':'')+'/>';
}
function footer(chosen,d) {
  const latest=new Map();
  for(const row of chosen?.rows||[]) {
    if(!latest.has(row.profession_id)||latest.get(row.profession_id).year<row.year) latest.set(row.profession_id,row);
  }
  const ids=[...new Set([...latest.values()].map(r=>r.source_id))].join('  /  ');
  return line(48,573,1152,573)+txt(48,596,(d.source||brand+' · Source register')+(d.years?'   ·   '+d.years:''),15,palette.muted)+
    (ids?txt(48,617,'LATEST TABLE ID   '+ids,12,palette.muted):'');
}
function pointChart(traces,x,y,w,h,unit,title) {
  if (!traces.some(t=>t.rows.length)) {
    return '<rect x="'+x+'" y="'+y+'" width="'+w+'" height="'+h+'" fill="'+palette.panel+'"/>'+
      txt(x+18,y+h/2,'No matched race-by-sex series',21,palette.muted,serif)+
      txt(x+18,y+h/2+30,'A missing estimate is not zero.',16,palette.muted);
  }
  const svg=singleChart(traces,{paper:true,title,percent:isPct(unit),width:w,height:h});
  return nested(svg,x,y,w,h);
}
async function professionImage(p,index) {
  const {traces,chosen}=preferCard(series.filter(r=>r.profession_id===p.slug));
  const d=descriptor(chosen),role=roleFor(p);
  const [title,roleSvg]=await cardType(p.name,role);
  const proposed=p.origin.status==='draft'||p.gate.status==='draft';
  return wrap(framing('PROFESSION INDEX     /     '+String(index+1).padStart(2,'0'))+
    nested(title,48,102,1080,78)+line(48,192,1152,192)+
    panel(48,229,'01   Historical context',p.origin.headline,'supported')+line(48,313,524,313)+
    panel(48,347,'02   Entry decisions',p.gate.headline,'supported')+line(48,435,524,435)+
    txt(48,465,'SCOPE  /  FIELD HISTORY',14,palette.teal)+nested(roleSvg,48,472,477,110)+
    line(555,211,555,570)+txt(583,229,'03   TREND / MEASURED',15,palette.teal)+
    txt(583,269,d.title,30,palette.ink,serif)+
    (chosen?keyLine(583,294,colours[0])+txt(618,300,'Black male',15,palette.ink)+keyLine(757,294,colours[1],true)+txt(792,300,'Black female',15,palette.ink):'')+
    pointChart(traces,578,321,574,173,chosen?.unit,d.title)+
    contentLines(d.definition,{x:583,y:523,limit:68,step:20,size:14,colour:palette.muted})+
    footer(chosen,d));
}
function comparisonImage(model) {
  const {picked,chosen,traces,unavailable}=model,d=descriptor(chosen);
  const left=48,top=158;
  let rows='';
  picked.forEach((p,i)=>{
    const y=top+i*102, off=!chosen||unavailable.includes(p);
    rows+=(off?'':keyLine(left+39,y-5,colours[i]))+txt(left,y,'0'+(i+1),14,off?palette.muted:colours[i])+
      txt(left,y+33,p.name,31,palette.ink,serif)+
      txt(left,y+61,off?'No comparable series':'Representation by sex',14,palette.muted)+
      line(left,y+80,437,y+80);
  });
  return wrap(framing('SHARED COMPARISON    /    '+String(picked.length).padStart(2,'0'))+
    txt(left,122,'SELECTED PROFESSIONS',14,palette.teal)+rows+
    line(466,104,466,553)+txt(494,122,'COMMON MEASURE',14,palette.teal)+txt(494,170,d.title,36,palette.ink,serif)+
    (chosen?txt(494,204,'Solid · Black male     Dashed · Black female',16,palette.muted):'')+
    pointChart(traces,491,230,661,238,chosen?.unit,d.title)+
    contentLines(d.definition,{x:494,y:504,limit:77,step:21,size:14,colour:palette.muted})+
    footer(chosen,d));
}
const paper = { background: '#f8f5ef', ink: '#202124', indigo: '#293d80', rust: '#874536', muted: '#545354', border: '#cdc6ba' };
const paperRule = y => '<path d="M48 '+y+' H1152" stroke="'+paper.border+'"/>';
function paperHeader(label) {
  return '<rect width="1200" height="630" fill="'+paper.background+'"/>'+paperMark+
    txt(102,58,brand,36,paper.ink,serif)+txt(1152,56,label,15,paper.muted,mono,'text-anchor="end"')+paperRule(88);
}
function paperFooter(label) {
  return paperRule(551)+txt(48,598,label,17,paper.muted)+
    txt(1152,598,new URL(config.site).hostname,18,paper.indigo,mono,'text-anchor="end"');
}
function coverImage() {
  return wrap(paperHeader('BLACK CAREER PATHWAYS')+
    txt(48,198,'Who opened the door',85,paper.ink,serif)+
    txt(48,292,'to your career?',87,paper.indigo,serif)+
    txt(50,350,'Trace the people and decisions that opened your field to Black workers.',22,paper.muted)+
    paperRule(404)+txt(48,447,'FROM THE TEACHER RECORD',15,paper.muted)+
    txt(48,511,teacherOpening.dateLabel,46,paper.rust,serif)+txt(200,497,teacherOpening.title,36,paper.ink,serif)+
    txt(200,526,teacherOpening.place+'  /  '+teacherOpening.sourceTitle.split(' · ')[0],16,paper.muted)+
    paperFooter('A field guide for Black professionals'));
}
const guideIllustrations = [
  {
    route: 'career-map',
    label: 'CAREER MAP',
    title: 'Where could my work lead?',
    description: 'See how the daily work and responsibility can change.',
    start: 'Your work', upper: 'Explore the field’s history', lower: 'Choose a next step',
    footer: 'Possible moves from one kind of work'
  },
  {
    route: 'explore',
    label: 'CAREER EXPLORER',
    title: 'What could I do?',
    description: 'Begin with something you enjoy. Find a job and a story to explore.',
    start: 'I like explaining things', upper: 'Help someone use technology', lower: 'Write instructions they can follow',
    footer: 'Try a small activity and discover a Door Note'
  }
];
function guideIllustration(record) {
  const branch = '<g fill="none" stroke="'+paper.indigo+'" stroke-width="3"><path d="M402 410 H475 V349 H539 M475 410 V471 H539"/></g>'+
    [349,471].map(y=>'<circle cx="539" cy="'+y+'" r="5" fill="'+paper.rust+'"/>').join('');
  return wrap(paperHeader(record.label)+
    txt(48,187,record.title,65,paper.ink,serif)+txt(49,239,record.description,24,paper.muted)+paperRule(285)+
    txt(48,363,'START HERE',14,paper.muted)+txt(48,419,record.start,32,paper.ink,serif)+branch+
    txt(564,360,record.upper,34,paper.indigo,serif)+txt(564,481,record.lower,34,paper.indigo,serif)+paperFooter(record.footer));
}
function paperWorkplaceImage({location, title, workplace, records, gap}) {
  const entries = records.map(([year, heading, place, publisher], index) => {
    const y = 322 + index * 132;
    return txt(48, y, year, 54, paper.rust, serif) +
      txt(220, y - 5, heading, 36, paper.ink, serif) +
      txt(220, y + 30, place + '  /  ' + publisher, 18, paper.muted);
  });
  return wrap(paperHeader('PUBLIC EXAMPLE  /  ' + location.toUpperCase()) +
    txt(48, 180, title, 76, paper.ink, serif) +
    txt(50, 222, workplace, 25, paper.muted) + paperRule(248) +
    entries.join(paperRule(385)) + paperFooter(gap));
}
function teacherImage() {
  return paperWorkplaceImage({
    location: 'Atlanta, Georgia',
    title: 'Public school teacher',
    workplace: 'Booker T. Washington High School',
    records: [
      [teacherOpening.dateLabel, teacherOpening.title, teacherOpening.place, teacherOpening.sourceTitle.split(' · ')[0]],
      [atlanta.eventDateLabel, atlanta.headline, atlanta.site.location, atlanta.sourceTitle.split(' · ')[0]]
    ],
    gap: 'Still unknown: whether these records connect.'
  });
}
// These illustrations belong to fixed, public examples. General profession
// cards continue to describe their profession even when a reader shares one.
const publicSampleCards = {
  'registered-nurse': {
    location: 'Washington, DC',
    title: 'Registered nurse',
    workplace: 'Howard University Hospital',
    records: [
      ['1968', 'Anna B. Coles becomes the first nursing dean at Howard', 'Washington, DC', 'Freedmen’s nursing alumni history'],
      ['1975', 'Howard University Hospital succeeds Freedmen’s', 'Washington, DC', 'Howard University College of Medicine']
    ],
    gap: 'Still unknown: an individual nurse’s route into a job.'
  },
  electrician: {
    location: 'Chicago, Illinois',
    title: 'Electrician',
    workplace: 'Taylor Electric Company',
    records: [
      ['1922', 'Sam Taylor starts his electrical contracting company', 'Chicago, Illinois', 'The HistoryMakers'],
      ['2017', 'Taylor lists Soldier Field in its project portfolio', 'Portfolio posted March 9', 'Taylor Electric Company']
    ],
    gap: 'Still unknown: who worked on the crew and how they were hired.'
  }
};
async function writeImage(svg,file) {
  const image = new Resvg(svg,resvgOptions).render();
  const png = await sharp(image.pixels,{raw:{width:WIDTH,height:HEIGHT,channels:4}})
    .png({palette:true,colours:96,effort:1,dither:0}).toBuffer();
  await fs.mkdir(path.dirname(file),{recursive:true});
  await fs.writeFile(file,png);
  return png.length;
}
function sharePage(model,route,query) {
  const names=model.picked.map(p=>p.name).join(' / '), d=descriptor(model.chosen);
  const title='Compare '+names+' · '+brand;
  const desc=(d.years?d.title+' · '+d.years+'. ':'')+d.definition;
  const image=url(route+'og.png?edition=paper');
  const alt=[brand+' comparison of '+names,d.title,d.years,d.definition,d.source].filter(Boolean).join('. ');
  const attr=s=>safe(s);
  const ids=[...new Set(model.chosen?.rows.map(r=>r.source_id)||[])];
  const refs=ids.map(id=>'<li><a href="/sources/#'+attr(id)+'">'+attr(sourceIndex.get(id)?.table_name||id)+'</a></li>').join('');
  return '<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1"><title>'+attr(title)+'</title>'+
    '<meta name="description" content="'+attr(desc)+'"><link rel="canonical" href="'+attr(url(route))+'">'+
    '<meta property="og:type" content="website"><meta property="og:site_name" content="'+attr(brand)+'"><meta property="og:title" content="'+attr(title)+'"><meta property="og:description" content="'+attr(desc)+'"><meta property="og:url" content="'+attr(url(route))+'">'+
    '<meta property="og:image" content="'+attr(image)+'"><meta property="og:image:type" content="image/png"><meta property="og:image:width" content="1200"><meta property="og:image:height" content="630">'+
    '<meta property="og:image:alt" content="'+attr(alt)+'"><meta name="twitter:card" content="summary_large_image"><meta name="twitter:title" content="'+attr(title)+'"><meta name="twitter:image" content="'+attr(image)+'">'+
    '<meta name="twitter:image:alt" content="'+attr(alt)+'"><meta name="twitter:description" content="'+attr(desc)+'"><meta name="theme-color" content="'+palette.bg+'"><link rel="icon" href="/mark-paper.svg">'+
    '<script>location.replace('+JSON.stringify(query)+')</script></head><body><main><a href="/" aria-label="'+attr(brand)+' home">'+attr(brand)+'</a><h1>'+attr(names)+'</h1><p>'+attr(desc)+'</p><p><a href="'+attr(query)+'">Open this comparison</a></p>'+
    '<p>'+attr(model.unavailable.length?'No comparable series for '+model.unavailable.map(p=>p.name).join(', ')+'.':'')+'</p>'+
    '<details><summary>Exact definitions and source tables</summary>'+[...new Set(model.chosen?.rows.map(r=>r.definition)||[])].map(s=>'<p>'+attr(s)+'</p>').join('')+'<ul>'+refs+'</ul></details></main></body></html>';
}
function* combinations(values,start=0,group=[]) {
  if(group.length) yield group;
  if(group.length===3) return;
  for(let i=start;i<values.length;i++) yield* combinations(values,i+1,[...group,values[i]]);
}
async function render() {
  const sample=process.argv[2]==='--sample';
  const out=sample?process.argv[3]:'dist';
  if (!out||sample&&path.resolve(out)===path.resolve('dist')) throw Error('Supply a separate sample directory');
  let bytes=await writeImage(coverImage(),path.join(out,'cover.png'));
  for (const guide of guideIllustrations) {
    bytes+=await writeImage(guideIllustration(guide),path.join(out,guide.route,'cover.png'));
  }
  const all=sample?professions.slice(0,1):professions;
  for(const [i,p] of all.entries()) bytes+=await writeImage(p.slug === 'k12-teacher' ? teacherImage() : await professionImage(p,i),path.join(out,'p',p.slug,'og.png'));
  for (const [slug, record] of Object.entries(publicSampleCards)) {
    bytes += await writeImage(paperWorkplaceImage(record), path.join(out, 'preview', 'p', slug, 'sample.png'));
  }
  const sorted=professions.map(p=>p.slug).sort();
  const picks=sample?[['engineer','physician','registered-nurse']]:combinations(sorted);
  let count=0;
  for (const ids of picks) {
    const model=compareModel(ids,data),key=ids.join('~'),route='/comparisons/'+key+'/',query='/compare/?p='+ids.join(',');
    const dir=path.join(out,'comparisons',key);
    bytes+=await writeImage(comparisonImage(model),path.join(dir,'og.png'));
    await fs.writeFile(path.join(dir,'index.html'),sharePage(model,route,query));
    count++;
  }
  console.log('Rendered '+all.length+' profession images, '+count+' comparison images, two workplace examples and the cover ('+(bytes/1048576).toFixed(1)+' MiB of PNGs).');
}
try { await render(); } finally { await fs.rm(fontDir,{recursive:true,force:true}); }
