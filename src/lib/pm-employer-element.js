import {pmTitles,safeRecordUrl,reviewedPmSources} from './pm-employer-sources.js';
const scopes={history:'Workplace history',role:'Role at this employer',funding:'Institutional funding',lead:'Research lead'};
const kinds={reviewed:'Reviewed source',live:'Retrieved live',indexed:'Indexed publication'};
const node=(tag,text)=>{const el=document.createElement(tag);if(text)el.textContent=text;return el};
function card(r){
  const article=node('article');article.className='pm-source';
  const link=node('a',r.title+' ↗');link.href=safeRecordUrl(r.url);link.target='_blank';link.rel='noopener noreferrer';
  const stamp=[scopes[r.scope],r.publisher,kinds[r.mode],r.publishedOn].filter(Boolean).join(' · ');
  article.append(node('small',stamp),link);
  for(const [label,body] of [['What it connects',r.connection],['Still open',r.limit]]){
    const line=node('p');line.append(node('strong',label+'. '),body);article.append(line);
  }
  return article;
}
class EmployerRecords extends HTMLElement{
  ctx=null; pending=null;
  part(key){return this.querySelector('[data-'+key+']')}
  connectedCallback(){this.part('find').addEventListener('click',this.search)}
  disconnectedCallback(){this.part('find').removeEventListener('click',this.search);this.reset()}
  reset(){
    this.pending?.abort();this.pending=null;this.ctx=null;this.hidden=true;
    this.part('find').removeAttribute('aria-disabled');this.part('find').querySelector('span').textContent='Search employer records';
    this.part('records').removeAttribute('aria-busy');this.part('records').replaceChildren();
    this.part('disclosure').textContent='';this.part('status').textContent='';
    this.part('coverage').open=false;this.part('coverage').hidden=true;
    this.part('wider').hidden=true;this.part('wider').removeAttribute('href');
  }
  setContext({employer}){
    employer=employer.trim();
    if(this.ctx?.employer===employer)return;
    this.reset();if(!employer)return;
    const profession=this.dataset.role,title=pmTitles[profession];
    this.ctx={employer,title,profession};
    this.part('disclosure').textContent='On tap, public sources receive the employer name. Door Notes checks for '+title.toLowerCase()+' records.';
    this.hidden=false;
  }
  notifyGap(ctx,records){
    this.dispatchEvent(new CustomEvent('pm-record',{bubbles:true,detail:{employer:ctx.employer,historical:records.find(r=>r.scope==='history'&&r.mode==='reviewed')}}));
  }
  search=async()=>{
    if(!this.ctx||this.pending)return;
    const ctx=this.ctx,req=new AbortController();this.pending=req;
    const button=this.part('find'),results=this.part('records'),status=this.part('status');
    button.setAttribute('aria-disabled','true');button.querySelector('span').textContent='Searching…';
    status.textContent='Checking records for '+ctx.employer+'…';
    results.setAttribute('aria-busy','true');results.replaceChildren();this.part('coverage').hidden=true;this.part('wider').hidden=true;
    const reviewed=reviewedPmSources(ctx.employer,ctx.profession);
    if(reviewed.length){
      reviewed.forEach(r=>results.append(card(r)));
      status.textContent='Reviewed workplace record found. Checking live publishers…';
      this.notifyGap(ctx,reviewed);
    }
    try{
      const {requestResearch}=await import('./request-research.js');
      const report=await requestResearch({...ctx,signal:req.signal});
      if(this.pending!==req)return;
      const matches=report.results.filter(r=>Object.hasOwn(scopes,r.scope)&&r.title&&r.connection&&r.limit&&safeRecordUrl(r.url));
      status.textContent=matches.length?matches.length+' employer '+(matches.length===1?'record':'records')+' for '+ctx.employer+'.':
        !report.providers.length?'Use a more specific workplace name to search.':
        report.status==='unavailable'?'Live sources were unavailable; no matching indexed or reviewed record was found. The connection is still open.':
        'No workplace connection found in the sources checked. The gap stays open.';
      if(report.status==='partial')status.append(' Some live checks were incomplete.');
      if(report.status==='unavailable'&&matches.length)status.append(' Live checks were unavailable.');
      results.replaceChildren();
      matches.slice(0,2).forEach(r=>results.append(card(r)));
      if(matches.length>2){const more=node('details');more.append(node('summary','See '+(matches.length-2)+' more '+(matches.length===3?'record':'records')));matches.slice(2).forEach(r=>more.append(card(r)));results.append(more)}
      if(report.providers.length){
        const ok=report.providers.filter(p=>p.status==='ok').map(p=>p.name),missing=report.providers.filter(p=>p.status!=='ok').map(p=>p.name);
        this.part('checked').textContent='Checked Door Notes’ reviewed records and publication index.'+(ok.length?' Live checks: '+ok.join('; ')+'.':'');
        this.part('missing').textContent=missing.length?'Could not finish: '+missing.join('; ')+'.':'';
        this.part('coverage').hidden=false;
      }
      // Only an explicitly reviewed historical record can change the workplace heading.
      this.notifyGap(ctx,matches);
    }catch{
      if(this.pending!==req)return;
      status.textContent=reviewed.length?'The reviewed record is shown. The live search could not finish.':'The search could not finish. The workplace connection is still open. You can retry or search more widely.';
    }finally{
      if(this.pending===req){
        this.pending=null;results.removeAttribute('aria-busy');button.removeAttribute('aria-disabled');button.querySelector('span').textContent='Search again';
        const url=new URL('https://www.google.com/search');
        url.searchParams.set('q','"'+ctx.employer+'" "'+ctx.title.toLowerCase()+'" (Black OR HBCU) (appointment OR hiring OR mentorship)');
        const wider=this.part('wider');wider.href=url.href;wider.hidden=false;
      }
    }
  }
}
if(!customElements.get('door-employer-records'))customElements.define('door-employer-records',EmployerRecords);
