export const safe=s=>String(s??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
export const colours=['#d6ec8c','#75c5bc','#e7a68b'];
function singleChart(traces,{percent=true,title='Representation by year',showBreak=true,width=650,height=235,paper=false}={}){
 const rows=traces.flatMap(t=>t.rows);
 if(!rows.length)return '';
 const min=1990,max=Math.max(2004,...rows.map(p=>p.year)),valueMax=Math.max(1,...rows.map(p=>p.value));
 const raw=valueMax/4,base=10**Math.floor(Math.log10(raw)), step=([1,2,2.5,5,10].find(n=>n>=raw/base)||10)*base;
 const top=percent?Math.min(100,Math.ceil(valueMax/step)*step):Math.ceil(valueMax/step)*step;
 const left=47,right=20,y0=height-33,y1=28;
 const x=v=>left+(v-min)/(max-min)*(width-left-right), y=v=>y0-(v/top)*(y0-y1);
 const line=(xx,yy,x2,y2,stroke,other='')=>'<line x1="'+xx+'" y1="'+yy+'" x2="'+x2+'" y2="'+y2+'" stroke="'+stroke+'" '+other+'/>';
 const axisText = paper ? '#545354' : '#a3b1a6';
 const grid = paper ? '#d4cec4' : '#38433c';
 const pointOutline = paper ? '#fffdf8' : '#172019';
 const txt=(xx,yy,s,extra='')=>'<text x="'+xx+'" y="'+yy+'" '+extra+' fill="'+axisText+'" font-size="11" font-family="monospace">'+safe(s)+'</text>';
 let svg='<svg class="chart" viewBox="0 0 '+width+' '+height+'" xmlns="http://www.w3.org/2000/svg" role="img" aria-label="'+safe(title)+'"><title>'+safe(title)+'</title>';
 for(let i=0;i<=4;i++){const v=top*i/4;svg+=line(left,y(v),width-right,y(v),grid)+txt(left-6,y(v)+4,Number(v.toFixed(2)).toLocaleString('en-US')+(percent?'%':''),'text-anchor="end"')}
 for(const yr of [1990,2000,2010,2020,max].filter((v,i,a)=>v<=max&&a.indexOf(v)===i&&(v===max||max-v>=3)))svg+=txt(x(yr),height-8,yr,'text-anchor="middle"');
 if(showBreak)svg+=line(x(2003),y1,x(2003),y0,paper ? '#756c63' : '#86967c','stroke-dasharray="3 5"')+txt(x(2003)+4,17,'2003 · CPS race definition changed');
 for(const t of traces){
  const ordered=[...t.rows].sort((a,b)=>a.year-b.year);
  let prev=null;
  for(const p of ordered){
   if(prev&&p.year===prev.year+1&&p.series_id===prev.series_id&&p.definition===prev.definition&&!(prev.year<2003&&p.year>=2003))svg+=line(x(prev.year),y(prev.value),x(p.year),y(p.value),t.colour,'stroke-width="2.5" '+(t.dash?'stroke-dasharray="5 3"':''));
   svg+='<a href="/sources/#'+safe(p.source_id)+'"><title>'+safe(t.label+' · '+p.year+' · '+p.value.toFixed(percent?1:0)+(percent?'%':''))+'</title><circle cx="'+x(p.year)+'" cy="'+y(p.value)+'" r="3.6" fill="'+t.colour+'" stroke="'+pointOutline+'" stroke-width="1"/></a>';prev=p;
  }
 }
 return svg+'</svg>';
}

export function chartSVG(traces,options={}){
 const wide=singleChart(traces,options), narrow=singleChart(traces,{...options,width:365,height:210});
 return '<div class="wide-chart">'+wide+'</div><div class="compact-chart">'+narrow+'</div>';
}
export { singleChart };
