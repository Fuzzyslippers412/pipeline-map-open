import fs from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { createRequire } from 'node:module';
import { inflateSync } from 'node:zlib';
import satori from 'satori';
import { Resvg } from '@resvg/resvg-js';
import sharp from 'sharp';
import { professions, sources, series, roleFor, labelList, isPct, variants } from '../src/lib/model.js';
import { singleChart, colours, safe } from '../src/lib/plot.js';
import { compareModel } from '../src/lib/compare.js';
import config from '../astro.config.mjs';

const require = createRequire(import.meta.url);
const WIDTH = 1200, HEIGHT = 630;
const palette = { bg:'#101614', panel:'#18221d', mint:'#d6ec8c', teal:'#75c5bc', ink:'#f1f3e6', muted:'#b2c0b4', line:'#38483b' };
const url = route => new URL(route,config.site).href;
const sourceIndex = new Map(sources.map(s => [s.id,s]));
const data = {professions,series};
const fontDir = await fs.mkdtemp(path.join(tmpdir(),'pipeline-map-fonts-'));
const mono = 'IBM Plex Mono', serif = 'Newsreader';
const fontSpec = [[mono,'ibm-plex-mono',400],[serif,'newsreader',500]];
const fontFiles = [], satoriFonts = [];
const brandMark = (await fs.readFile('public/mark.svg','utf8')).replace('<svg ','<svg x="48" y="28" ');
const atlas = await fs.readFile('public/atlas.svg','utf8');

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
  return '<rect width="1200" height="630" fill="'+palette.bg+'"/>'+brandMark+
    txt(103,57,'Pipeline Map',34,palette.ink,serif)+
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
  return line(48,573,1152,573)+txt(48,596,(d.source||'Pipeline Map · Source register')+(d.years?'   ·   '+d.years:''),15,palette.muted)+
    (ids?txt(48,617,'LATEST TABLE ID   '+ids,12,palette.muted):'');
}
function pointChart(traces,x,y,w,h,unit,title) {
  if (!traces.some(t=>t.rows.length)) {
    return '<rect x="'+x+'" y="'+y+'" width="'+w+'" height="'+h+'" fill="'+palette.panel+'"/>'+
      txt(x+18,y+h/2,'No matched race-by-sex series',21,palette.muted,serif)+
      txt(x+18,y+h/2+30,'A missing estimate is not zero.',16,palette.muted);
  }
  const svg=singleChart(traces,{title,percent:isPct(unit),width:w,height:h});
  return nested(svg,x,y,w,h);
}
async function professionImage(p,index) {
  const {traces,chosen}=preferCard(series.filter(r=>r.profession_id===p.slug));
  const d=descriptor(chosen),role=roleFor(p);
  const [title,roleSvg]=await cardType(p.name,role);
  const proposed=p.origin.status==='draft'||p.gate.status==='draft';
  return wrap(framing('PROFESSION INDEX     /     '+String(index+1).padStart(2,'0'))+
    nested(title,48,102,1080,78)+line(48,192,1152,192)+
    panel(48,229,'01   Origin',labelList(p.origin.builder),p.origin.status)+line(48,313,524,313)+
    panel(48,347,'02   Gate',labelList(p.gate.gatekeeper),p.gate.status)+line(48,435,524,435)+
    txt(48,465,proposed?'ROLE  /  PROPOSED EDITORIAL PAIR':'ROLE  /  EDITORIAL READING',14,palette.teal)+nested(roleSvg,48,472,477,110)+
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
function coverImage() {
  return wrap(framing('A SOURCE-LINKED PROFESSION INDEX')+
    txt(48,176,'Origin. Gate. Trend.',72,palette.ink,serif)+
    txt(48,222,'Trace the institutions that opened U.S. professions to Black Americans.',22,palette.muted)+
    nested(atlas,521,260,624,283)+line(48,565,1152,565)+
    txt(48,602,'Compare professions   /   Trace every measured point to a public table',16,palette.muted)+
    txt(48,326,'01    ORIGIN',20,palette.mint)+txt(48,389,'02    GATE',20,palette.teal)+txt(48,452,'03    TREND',20,palette.ink));
}
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
  const title='Compare '+names+' · Pipeline Map';
  const desc=(d.years?d.title+' · '+d.years+'. ':'')+d.definition;
  const image=url(route+'og.png');
  const alt=[names,d.title,d.years,d.definition,d.source].filter(Boolean).join('. ');
  const attr=s=>safe(s);
  const ids=[...new Set(model.chosen?.rows.map(r=>r.source_id)||[])];
  const refs=ids.map(id=>'<li><a href="/sources/#'+attr(id)+'">'+attr(sourceIndex.get(id)?.table_name||id)+'</a></li>').join('');
  return '<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1"><title>'+attr(title)+'</title>'+
    '<meta name="description" content="'+attr(desc)+'"><link rel="canonical" href="'+attr(url(route))+'">'+
    '<meta property="og:type" content="website"><meta property="og:title" content="'+attr(title)+'"><meta property="og:description" content="'+attr(desc)+'"><meta property="og:url" content="'+attr(url(route))+'">'+
    '<meta property="og:image" content="'+attr(image)+'"><meta property="og:image:type" content="image/png"><meta property="og:image:width" content="1200"><meta property="og:image:height" content="630">'+
    '<meta property="og:image:alt" content="'+attr(alt)+'"><meta name="twitter:card" content="summary_large_image"><meta name="twitter:title" content="'+attr(title)+'"><meta name="twitter:image" content="'+attr(image)+'">'+
    '<meta name="twitter:image:alt" content="'+attr(alt)+'"><meta name="theme-color" content="'+palette.bg+'">'+
    '<script>location.replace('+JSON.stringify(query)+')</script></head><body><main><h1>'+attr(names)+'</h1><p>'+attr(desc)+'</p><p><a href="'+attr(query)+'">Open this comparison</a></p>'+
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
  const all=sample?professions.slice(0,1):professions;
  for(const [i,p] of all.entries()) bytes+=await writeImage(await professionImage(p,i),path.join(out,'p',p.slug,'og.png'));
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
  console.log('Rendered '+all.length+' profession images, '+count+' comparison images and the cover ('+(bytes/1048576).toFixed(1)+' MiB of PNGs).');
}
try { await render(); } finally { await fs.rm(fontDir,{recursive:true,force:true}); }
