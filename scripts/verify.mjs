import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
import fs from 'node:fs/promises';
import path from 'node:path';
import {parse} from 'parse5';
import config from '../astro.config.mjs';
import {pmRoleRecords} from '../src/lib/pm-role-records.js';
import {professions, sources, series, amount, roleFor} from '../src/lib/model.js';
import {singleChart} from '../src/lib/plot.js';
import {compareModel} from '../src/lib/compare.js';

const dist='dist', site=new URL(config.site);
const slugs=professions.map(p=>p.slug);
assert.ok(slugs.length>=20);
assert.equal(new Set(slugs).size,slugs.length);
assert.ok(slugs.every(s=>/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(s)));

function* nodes(node) {
  yield node;
  for(const child of node.childNodes||[]) yield* nodes(child);
}
const val=(node,name)=>node?.attrs?.find(a=>a.name===name)?.value;
const text=node=>node?.nodeName==='#text'?node.value:(node?.childNodes||[]).map(text).join('');
const children=(node,tag)=>[...nodes(node)].filter(n=>n.tagName===tag);
const hasHref=(list,url)=>list.some(n=>n.tagName==='a'&&val(n,'href')===url);
function expectEl(list,key,value,message) {
  const hit=list.find(n=>val(n,key)===value);
  assert.ok(hit,message||('Missing '+key+'='+value));
  return hit;
}
const files=new Set();
async function inventory(dir) {
  for(const ent of await fs.readdir(dir,{withFileTypes:true})) {
    const file=path.join(dir,ent.name);
    if(ent.isDirectory()) await inventory(file);
    else if(ent.isFile()) files.add('/'+path.relative(dist,file).split(path.sep).join('/'));
  }
}
await inventory(dist);
const disk=route=>path.join(dist,route);
function target(route) {
  if(route.endsWith('/')) return route+'index.html';
  return files.has(route)?route:route+'/index.html';
}
const anchors=new Map();
const pendingAnchors=new Map();
function verifyLinks(list,route) {
  const base=new URL(route,site);
  const pageIds=new Set();
  for(const n of list) {
    const id=val(n,'id');
    if(id) { assert.ok(!pageIds.has(id),'Duplicate id '+route+'#'+id); pageIds.add(id); }
    if(!['a','link','script','img'].includes(n.tagName)) continue;
    const href=val(n,'href')??val(n,'src');
    if(!href) continue;
    const u=new URL(href,base);
    if(u.origin!==site.origin) continue;
    const file=target(decodeURIComponent(u.pathname));
    assert.ok(files.has(file),'Unresolved internal URL '+href+' in '+route);
    if(u.hash&&u.hash!=='#') {
      if(!pendingAnchors.has(file)) pendingAnchors.set(file,new Set());
      pendingAnchors.get(file).add(decodeURIComponent(u.hash.slice(1)));
    }
  }
  anchors.set(target(route),pageIds);
}
const pngHashes=new Set();
async function verifyImage(route) {
  assert.ok(files.has(route),'Missing '+route);
  const bytes=await fs.readFile(disk(route));
  assert.equal(bytes.subarray(0,8).toString('hex'),'89504e470d0a1a0a',route);
  assert.equal(bytes.toString('ascii',12,16),'IHDR',route);
  assert.equal(bytes.readUInt32BE(16),1200,route+' width');
  assert.equal(bytes.readUInt32BE(20),630,route+' height');
  assert.equal(bytes.toString('ascii',bytes.length-8,bytes.length-4),'IEND',route+' incomplete PNG');
  const hash=createHash('sha256').update(bytes).digest('hex');
  assert.ok(!pngHashes.has(hash),'Unexpected identical social images: '+route);
  pngHashes.add(hash);
}
function metadata(list,route,imagePath,{canonicalRoute=route,socialRoute=route}={}) {
  const meta=(key)=>val(list.find(n=>n.tagName==='meta'&&(val(n,'property')===key||val(n,'name')===key)),'content');
  const canonical=val(list.find(n=>n.tagName==='link'&&val(n,'rel')==='canonical'),'href');
  assert.equal(canonical,new URL(canonicalRoute,site).href,route+' canonical');
  assert.equal(meta('og:url'),new URL(socialRoute,site).href,route+' og:url');
  const expectedImage=new URL(imagePath,site);
  if(imagePath==='/cover.png'||imagePath.endsWith('/og.png')) expectedImage.searchParams.set('edition','paper');
  assert.equal(meta('og:image'),expectedImage.href,route+' image URL');
  assert.equal(meta('og:image:width'),'1200'); assert.equal(meta('og:image:height'),'630');
  assert.ok(meta('og:title')?.trim()&&meta('og:description')?.trim()&&meta('og:image:alt')?.trim(),route+' social copy');
  assert.equal(meta('twitter:card'),'summary_large_image',route+' X card');
  return {meta,canonical};
}
async function readPage(route) {
  const file=target(route);
  assert.ok(files.has(file),'Missing page '+route);
  const list=[...nodes(parse(await fs.readFile(disk(file),'utf8')))];
  verifyLinks(list,route);
  return list;
}

const docHome=await readPage('/');
metadata(docHome,'/','/cover.png');
await verifyImage('/cover.png');
expectEl(docHome,'role','combobox','Missing profession search');
const search=JSON.parse(text(expectEl(docHome,'id','search-index')));
expectEl(docHome,'id','index-search');
expectEl(docHome,'id','directory-match');
expectEl(docHome,'id','computing-record-title');
const directoryPath='/data/job-occupations.json';
assert.ok(files.has(directoryPath),'Missing job occupations in the published build');
const occupationalData=JSON.parse(await fs.readFile(disk(directoryPath),'utf8'));
assert.equal(occupationalData.version,1);
assert.ok(occupationalData.entries.length>40000 && occupationalData.occupations.length>900,'Incomplete occupational directory');
assert.equal(search.length,slugs.length);
for(const p of professions) {
  assert.ok(hasHref(docHome,'/p/'+p.slug+'/'),p.slug+' missing index link');
  assert.deepEqual(search.find(s=>s.slug===p.slug)?.aliases,p.aliases);
}
const classicHome=await readPage('/study/original/');
const classicTeacher=await readPage('/study/original/p/k12-teacher/');
for(const page of [classicHome,classicTeacher]) {
  assert.ok(page.some(n=>val(n,'name')==='robots' && val(n,'content')?.includes('noindex')),'Study controls must not be indexed');
  assert.ok(!page.some(n=>n.tagName==='body' && val(n,'class')?.includes('paper-edition')),'Study controls must retain the classic theme');
}
assert.equal(expectEl(classicHome,'id','try-teacher').tagName,'button');
assert.equal(val(expectEl(docHome,'id','try-teacher'),'href'),'/p/k12-teacher/?example=1#path-preview');
assert.ok(docHome.some(n=>n.tagName==='body' && val(n,'class')?.includes('paper-edition')),'Missing paper homepage');
const paths=await readPage('/paths/');
const readerTest=await readPage('/try/');
const explorer=await readPage('/explore/');
const careerMap=await readPage('/career-map/');
const pilotTest=await readPage('/try/routes/');
for (const [route,page] of [['/explore/',explorer],['/career-map/',careerMap]]) {
  assert.ok(hasHref(docHome,route) && hasHref(paths,route),'Missing entry point for '+route);
  const card=route+'cover.png';
  metadata(page,route,card);
  await verifyImage(card);
}
expectEl(explorer,'id','explore-form');
expectEl(explorer,'id','explore-results');
expectEl(careerMap,'id','responsibility');
expectEl(careerMap,'id','compare-moves');
expectEl(careerMap,'id','door-note');
expectEl(careerMap,'id','career-hub');
for(const slug of [...slugs,'project-manager','technical-writing',...Object.keys(pmRoleRecords)]){
  const guide=await readPage('/career-map/'+slug+'/');
  expectEl(guide,'id','conversation');
  const role=pmRoleRecords[slug];
  if(role||slug==='project-manager'){
    assert.ok(guide.some(n=>val(n,'data-pm-path')!==undefined),'Missing connection preview: '+slug);
    for(const stage of ['person','opportunity','role','workplace'])expectEl(guide,'data-stage',stage);
    assert.ok(guide.some(n=>val(n,'data-stage')==='role'&&val(n,'data-open')!==undefined),'Personal route must stay open');
    assert.ok(guide.some(n=>val(n,'data-stage')==='workplace'&&val(n,'data-open')!==undefined),'Workplace connector must stay open');
    expectEl(guide,'data-next-toggle','');expectEl(guide,'data-suggest','');
  }
  if(role){
    for(const record of [role.first,role.second]){
      for(const page of [guide,docHome]){
        assert.ok(page.some(node=>['h2','h3'].includes(node.tagName)&&text(node)===record.person),slug+' history');
        for(const [,url] of record.sources)assert.ok(hasHref(page,url),slug+' source '+url);
      }
    }
  }
  if(slug==='project-manager'){
    for(const person of ['Asya Watkins','Zena Howard','Joseph Hunt','Bayard Rustin']){
      assert.ok(guide.some(node=>node.tagName==='h2' && text(node)===person),'Missing PM history: '+person);
    }
  }
}
assert.ok(hasHref(readerTest,'/try/routes/') && hasHref(pilotTest,'/explore/') && hasHref(pilotTest,'/career-map/'),'Missing pilot feedback route');

const nomination=await readPage('/suggest/');
assert.ok(hasHref(paths,'/suggest/') && hasHref(readerTest,'/suggest/'),'Workplace nomination missing from a reader entry point');
assert.ok(hasHref(readerTest,'/?exercise=unlisted#trace'),'Missing unlisted-school exercise');
expectEl(docHome,'id','exercise-prompt');
expectEl(nomination,'id','workplace-form');
for(const slug of ['k12-teacher','registered-nurse','electrician']) {
  const path=(slug==='k12-teacher' ? '/p/' : '/preview/p/')+slug+'/';
  assert.ok(hasHref(paths,path+'?example=1#who-decides'), 'Library missing current authority link for '+slug);
  expectEl(await readPage(path),'id','who-decides', 'Missing current authority section for '+slug);
}
for (const slug of ['registered-nurse','electrician']) {
  const sampleRoute='/preview/p/'+slug+'/';
  const sampleLink=sampleRoute+'?example=1#path-preview';
  assert.ok(hasHref(paths,sampleLink),'Paths directory missing '+sampleLink);
  assert.ok(hasHref(readerTest,sampleLink),'Reader test missing '+sampleLink);
  const preview=await readPage(sampleRoute);
  const imagePath=sampleRoute+'sample.png';
  const {meta}=metadata(preview,sampleRoute,imagePath,{canonicalRoute:'/p/'+slug+'/',socialRoute:sampleRoute+'?example=1'});
  assert.equal(meta('twitter:image'),new URL(imagePath,site).href);
  assert.equal(meta('twitter:image:alt'),meta('og:image:alt'));
  await verifyImage(imagePath);
}
const registry=await readPage('/sources/');
const sourceIds=new Set(sources.map(s=>s.id));
assert.equal(sourceIds.size,sources.length);
for(const s of sources) {
  const row=expectEl(registry,'id',s.id);
  assert.equal(row.tagName,'tr',s.id);
  if(s.locator) assert.ok(text(row).includes(s.locator),s.id+' source locator');
  assert.ok(hasHref([...nodes(row)],s.url),s.id+' publisher URL');
  assert.ok(text(row).includes(s.table_name)&&text(row).includes(s.definition)&&text(row).includes(s.retrieved_on),s.id+' source details');
}
const definitions=new Map();
for(const r of series) {
  assert.ok(slugs.includes(r.profession_id)&&sourceIds.has(r.source_id),JSON.stringify(r));
  assert.ok(r.definition.trim()&&r.series_id&&Number.isFinite(r.value),JSON.stringify(r));
  const key=r.profession_id+'|'+r.group+'|'+r.series_id;
  if(definitions.has(key)) assert.equal(r.definition,definitions.get(key),'Multiple definitions share series ID '+key);
  definitions.set(key,r.definition);
}
await readPage('/compare/');
const method=await readPage('/method/');
expectEl(method,'id','role-matrix'); expectEl(method,'id','corrections');
const compareData=JSON.parse(await fs.readFile(disk('/data/compare.json'),'utf8'));
assert.deepEqual(compareData.series,series,'Browser compare data differs from catalog');
assert.deepEqual(compareData.professions.map(p=>p.slug),slugs);
for(const p of professions) {
  const route='/p/'+p.slug+'/', list=await readPage(route), imagePath=route+'og.png';
  metadata(list,route,imagePath); await verifyImage(imagePath);
  assert.ok(list.some(n=>n.tagName==='body'&&val(n,'class')?.includes('paper-edition'))&&hasHref(list,'/explore/')&&hasHref(list,'/career-map/'),route+' guide navigation');
  const heading=list.find(n=>n.tagName==='h1');
  assert.equal(text(heading),p.name,route+' title');
  const parts=['origin','gate','trend','role'].map(k=>expectEl(list,'id',k));
  assert.deepEqual(list.filter(n=>parts.includes(n)),parts,route+' panel order');
  for(const [i,key] of ['origin','gate'].entries()) {
    const panel=parts[i], desc=p[key], inside=[...nodes(panel)];
    assert.ok(text(panel).includes(desc.rationale)&&text(panel).includes(desc.era),p.slug+' '+key+' editorial rationale');
    const chip=inside.find(n=>(val(n,'class')||'').split(' ').includes('edit-tag'));
    assert.equal(text(chip),'Context & scope',p.slug+' '+key+' label');
    assert.ok(text(panel).includes(desc.headline),p.slug+' precise heading');
    assert.ok(desc.citations.length>=2&&desc.citations.every(c=>hasHref(inside,c.url)),p.slug+' '+key+' citations');
  }
  assert.ok(text(parts[3]).includes(roleFor(p)),route+' matrix result');
  assert.ok(text(parts[3]).includes(p.researchQuestion),route+' specific research question');
  const history=expectEl(list,'id','field-history');
  assert.ok(!val(history,'hidden'),'Field history must be available without a trace');
  assert.ok(children(history,'li').length>=2,route+' historical episodes');
  assert.ok(hasHref(list,'/compare/?p='+p.slug)&&list.some(n=>n.tagName==='a'&&text(n).includes('Report an error')),route+' next actions');
  const observations=series.filter(r=>r.profession_id===p.slug&&['black_male','black_female'].includes(r.group));
  const measured=children(parts[2],'tr').map(row=>{
    const cols=children(row,'td');
    if(cols.length!==4)return '';
    const amountLink=children(cols[2],'a')[0],sourceLink=children(cols[3],'a')[0];
    assert.ok(amountLink&&sourceLink&&val(amountLink,'href')===val(sourceLink,'href'),p.slug+' numeric source');
    return [text(cols[0]),text(cols[1]),text(amountLink),val(sourceLink,'href')].join('|');
  });
  for(const r of observations) {
    const key=[r.year,r.group==='black_male'?'Black male':'Black female',amount(r),'/sources/#'+r.source_id].join('|');
    assert.ok(measured.includes(key),p.slug+' observation not sourced '+key);
    assert.ok(text(parts[2]).includes(r.definition),p.slug+' missing definition');
  }
  if(observations.length) assert.ok(text(parts[2]).includes('race definition changed'),route+' break label');
  else assert.match(text(parts[2]),/not yet verified/i,p.slug+' missing empty state');
}
function* selections(values,at=0,chosen=[]) {
  if(chosen.length) yield chosen;
  if(chosen.length===3)return;
  for(let i=at;i<values.length;i++) yield* selections(values,i+1,[...chosen,values[i]]);
}
const combos=[...selections([...slugs].sort())];
const actual=[...files].filter(f=>/^\/comparisons\/[^/]+\/index\.html$/.test(f));
assert.equal(combos.length,slugs.length+slugs.length*(slugs.length-1)/2+slugs.length*(slugs.length-1)*(slugs.length-2)/6); assert.equal(actual.length,combos.length);
for(const ids of combos) {
  const route='/comparisons/'+ids.join('~')+'/',img=route+'og.png',query='/compare/?p='+ids.join(',');
  const list=await readPage(route);
  const {meta}=metadata(list,route,img);
  assert.equal(meta('twitter:image'),new URL(img+'?edition=paper',site).href); assert.ok(meta('twitter:image:alt')?.trim());
  await verifyImage(img);
  assert.ok(hasHref(list,query),'Missing exact fallback link '+route);
  assert.ok(list.some(n=>n.tagName==='script'&&text(n)==='location.replace('+JSON.stringify(query)+')'),'Missing exact redirect '+route);
  const model=compareModel(ids,compareData);
  for(const p of model.picked) assert.ok(meta('og:title').includes(p.name),route+' title selection');
  if(model.chosen) {
    assert.ok(meta('og:description').includes(model.chosen.label),route+' measure mismatch');
    for(const r of model.chosen.rows) assert.ok(hasHref(list,'/sources/#'+r.source_id)&&list.some(n=>n.tagName==='p'&&text(n)===r.definition),route+' missing exact source/definition');
  } else assert.match(meta('og:description'),/No verified observations/,route+' empty state');
}
for(const [file,frags] of pendingAnchors) {
  for(const id of frags) assert.ok(anchors.get(file)?.has(id),file+' missing anchor #'+id);
}
// A connected segment requires adjacent years, a continuous series, the same
// population definition, and no 2003 break. Isolated marked points still render.
function segmentCount(a,b) {
  const rows=[a,b].map(v=>({series_id:'tab-a',definition:'Black alone',source_id:'audit',value:2,...v}));
  const svg=singleChart([{label:'test',colour:'#fe0189',rows}]);
  assert.equal((svg.match(/<circle /g)||[]).length,2);
  return (svg.match(/<line [^>]*stroke="#fe0189"/g)||[]).length;
}
assert.equal(segmentCount({year:2018},{year:2019}),1);
assert.equal(segmentCount({year:2002},{year:2003}),0);
assert.equal(segmentCount({year:2019},{year:2021}),0);
assert.equal(segmentCount({year:2021},{year:2022,series_id:'tab-b'}),0);
assert.equal(segmentCount({year:2021},{year:2022,definition:'Black alone or in combination'}),0);
console.log('Verified '+slugs.length+' profession cards, '+combos.length+' comparison previews, '+pngHashes.size+' distinct 1200×630 images, '+sources.length+' sources, '+series.length+' measurements, internal links and chart discontinuities.');
