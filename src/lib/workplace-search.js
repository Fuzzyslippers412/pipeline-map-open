import {normalizeEmployerText} from './employer-key.js';

export function packDirectory(records, sources={}) {
  const strings=[''], ids=new Map([['',0]]);
  function intern(value=''){
    const s=String(value || '');
    if(!ids.has(s)){ids.set(s,strings.length);strings.push(s)}
    return ids.get(s);
  }
  const rows=[];
  for(const item of records){
    if(typeof item.name!=='string'||!item.name.trim())continue;
    rows.push([item.name,intern(item.parent),intern(item.relation),intern(item.location),intern(item.kind),
      item.aliases?.length?item.aliases:0,intern(item.source),item.priority??(item.reviewed?2:0),intern(item.id),intern(item.sourceUrl)]);
  }
  return {strings,sources,rows};
}

const words = text => text.split(' ').filter(Boolean);
const hasWordStarts = (tokens,query) => query.every(word=>tokens.some(token=>token.startsWith(word)));
const begins = (value,q) => value===q || value.startsWith(q+' ') || value.startsWith(q);
const compareText = new Intl.Collator('en-US',{sensitivity:'base',numeric:true});

// Full names and affiliations represent different match fields. Matching a
// district can surface its schools, but selecting one always commits the school.
function alternateName(name) {
  const expanded=name.replace(/\bhs\b/g,'high school').replace(/\bms\b/g,'middle school').replace(/\bes\b/g,'elementary school')
    .replace(/\belem\b/g,'elementary').replace(/\bctr\b/g,'center').replace(/\buniv\b/g,'university');
  if(expanded!==name)return expanded;
  const short=name.replace(/\bhigh school\b/g,'hs').replace(/\bmiddle school\b/g,'ms').replace(/\belementary school\b/g,'es')
    .replace(/\bmedical center\b/g,'med ctr');
  return short===name?'':short;
}
export class WorkplaceSearch {
  constructor(){this.records=[];this.byPrefix=new Map();this.sharedTerms=new Map()}
  terms(value){
    if(!this.sharedTerms.has(value)){
      const text=normalizeEmployerText(value);this.sharedTerms.set(value,{text,tokens:words(text)});
    }
    return this.sharedTerms.get(value);
  }
  add({strings,rows,sources}){
    for(const [name,parentId,relId,cityId,kindId,aliases,sourceId,featured,stableId,sourceUrlId] of rows){
      const parent=strings[parentId],location=strings[cityId],relation=strings[relId],kind=strings[kindId];
      const norm=normalizeEmployerText(name);
      const alt=(aliases||[]).map(normalizeEmployerText);
      const alternate=alternateName(norm);if(alternate)alt.push(alternate);
      const {text:parentText,tokens:parentWords}=this.terms(parent);
      const tokens=words(norm),aliasWords=alt.map(words);
      const locationWords=this.terms(location).tokens;
      const record={name,parent,relation,location,kind,norm,alt,tokens,aliasWords,parentText,parentWords,locationWords,
        priority:featured,id:strings[stableId]||'',sourceUrl:strings[sourceUrlId]||sources?.[strings[sourceId]]?.url||''};
      const id=this.records.push(record)-1;
      // The short prefix index avoids scanning the national directory for each letter.
      for(const prefix of new Set([...tokens,...aliasWords.flat(),...parentWords,...locationWords].filter(t=>t.length>=2).map(t=>t.slice(0,2)))){
        if(!this.byPrefix.has(prefix))this.byPrefix.set(prefix,[]);
        this.byPrefix.get(prefix).push(id);
      }
    }
  }
  search(text,limit=5){
    const q=normalizeEmployerText(text), tokens=words(q);
    if(q.length<2||!tokens.length)return [];
    const lists=tokens.filter(t=>t.length>=2).map(t=>this.byPrefix.get(t.slice(0,2))||[]);
    const candidates=lists.length?lists.reduce((small,list)=>list.length<small.length?list:small):[];
    const found=[];
    for(const id of candidates){
      const r=this.records[id];
      let score=0;
      if(r.norm===q)score=950;
      else if(r.alt.includes(q))score=900;
      else if(begins(r.norm,q))score=720;
      else if(r.alt.some(a=>begins(a,q)))score=680;
      else if(hasWordStarts(r.tokens,tokens))score=590;
      else if(r.aliasWords.some(a=>hasWordStarts(a,tokens)))score=560;
      else if(hasWordStarts([...r.tokens,...r.locationWords,...r.parentWords],tokens)&&
          tokens.some(t=>r.tokens.some(w=>w.startsWith(t))))score=480;
      else if(r.parentText===q||hasWordStarts(r.parentWords,tokens))score=350;
      if(!score)continue;
      score+=r.priority*45+(r.parent?12:0)+(r.location?3:0)+(r.tokens.includes(q)?9:0);
      found.push({r,score});
    }
    found.sort((a,b)=>b.score-a.score||a.r.name.length-b.r.name.length||compareText.compare(a.r.name,b.r.name)||compareText.compare(a.r.location,b.r.location));
    const out=[],seen=new Map();
    for(const {r} of found){
      // Duplicate legal names can have multiple real sites. Keep different
      // places distinct and prefer the richer listing over a locationless copy.
      const prior=seen.get(r.norm)||[];
      if(prior.some(p=>normalizeEmployerText(p.location)===normalizeEmployerText(r.location)&&normalizeEmployerText(p.parent)===normalizeEmployerText(r.parent)) ||
          (!r.location&&!r.parent&&prior.length) ||
          (prior.some(p=>normalizeEmployerText(p.location)===normalizeEmployerText(r.location)&&p.parent)&&!r.parent))continue;
      seen.set(r.norm,[...prior,r]);
      out.push({key:r.id||r.norm+'|'+r.location+'|'+r.parent,...(r.id?{id:r.id}:{}),value:r.name,label:r.name,parent:r.parent,
        relation:r.relation,detail:r.parent?(r.relation||'Parent organization')+': '+r.parent:r.kind,
        location:r.location,sourceUrl:r.sourceUrl});
      if(out.length>=limit)break;
    }
    return out;
  }
}
