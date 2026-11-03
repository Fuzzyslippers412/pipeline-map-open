const PAGE = 12;
const norm = value => value.normalize('NFKD').replace(/[\u0300-\u036f]/g,'').toLowerCase();
export function bindSourceRegister(doc) {
  const form=doc.querySelector('#source-filters'), table=doc.querySelector('.source-records');
  if (!form || !table) return;
  const search=form.querySelector('#source-search'), field=form.querySelector('#source-profession'), order=form.querySelector('#source-order');
  const more=doc.querySelector('#more-sources'), clear=doc.querySelector('#source-clear'), count=doc.querySelector('#source-count');
  const empty=doc.querySelector('#no-sources'), banner=doc.querySelector('#cited-banner'), browse=doc.querySelector('#browse-register');
  const body=table.tBodies[0], rows=[...body.rows];
  const index=rows.map(row=>({row, text:norm([row.id,row.textContent].join(' ')),fields:new Set(row.dataset.fields.split(' '))}));
  let limit=PAGE, cited=null;
  function render() {
    const words=norm(search.value.trim()).split(/\s+/).filter(Boolean);
    const hits=index.filter(item=>(!field.value||item.fields.has(field.value)) && words.every(w=>item.text.includes(w)));
    if(order.value!=='catalog') hits.sort((a,b)=>order.value==='date'?b.row.dataset.date.localeCompare(a.row.dataset.date):a.row.dataset[order.value].localeCompare(b.row.dataset[order.value]));
    const list=cited?[cited]:hits.slice(0,limit).map(v=>v.row);
    body.replaceChildren(...list);
    more.hidden=Boolean(cited)||hits.length<=limit;
    more.textContent='Show '+Math.min(PAGE,Math.max(0,hits.length-limit))+' more sources';
    clear.hidden=(!search.value&&!field.value)||Boolean(cited);
    empty.hidden=Boolean(cited)||hits.length>0;
    table.hidden=!cited&&!hits.length;
    banner.hidden=!cited;
    form.hidden=Boolean(cited);
    count.textContent=cited?'1 cited source':hits.length?'Showing '+list.length+' of '+hits.length+' source '+(hits.length===1?'table':'tables'):'0 matching tables';
    return list;
  }
  function reveal() {
    cited=rows.find(row=>'#'+row.id===location.hash) || null;
    if(cited){cited.querySelector('details').open=true;search.value='';field.value='';}
    limit=PAGE;render();
    if(cited) requestAnimationFrame(()=>{banner.scrollIntoView({block:'start',behavior:'instant'});});
  }
  function reset(){form.reset();limit=PAGE;render();search.focus();}
  form.addEventListener('submit',e=>e.preventDefault());
  search.addEventListener('input',()=>{limit=PAGE;render()});
  for(const control of [field,order]) control.addEventListener('change',()=>{limit=PAGE;render()});
  more.addEventListener('click',()=>{const previous=limit;limit+=PAGE;const list=render();list[previous]?.querySelector('.source-title')?.focus();});
  clear.addEventListener('click',reset);
  browse.addEventListener('click',e=>{
    if(e.metaKey||e.ctrlKey||e.altKey||e.shiftKey) return;
    e.preventDefault();history.pushState(null,'',browse.href);cited=null;reset();
  });
  window.addEventListener('hashchange',reveal);reveal();
}
