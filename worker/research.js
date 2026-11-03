import {discoverSources} from '../src/lib/discover-sources.js';

const limit=1300;
const json=(body,status=200)=>new Response(JSON.stringify(body),{status,headers:{
  'Content-Type':'application/json; charset=utf-8','Cache-Control':'no-store','X-Content-Type-Options':'nosniff',
  'Referrer-Policy':'no-referrer'
}});
let active=0;

// Requests contain personal work details. Read a bounded body before decoding,
// and never place the terms in a URL, log, cache key, or durable store.
async function boundedBody(request){
  const reader=request.body?.getReader();
  if(!reader)return '';
  const decoder=new TextDecoder();
  let bytes=0,text='';
  try {
    while(true){
      const {value,done}=await reader.read();
      if(done) break;
      bytes+=value.byteLength;
      if(bytes>limit){await reader.cancel();return null}
      text+=decoder.decode(value,{stream:true});
    }
    return text+decoder.decode();
  }finally{reader.releaseLock()}
}

export async function handleResearch(request,search=discoverSources){
  if(request.method!=='POST')return json({error:'Use POST for a workplace search.'},405);
  const origin=request.headers.get('Origin');
  if((origin&&origin!==new URL(request.url).origin)||request.headers.get('Sec-Fetch-Site')==='cross-site')
    return json({error:'Use the search on Door Notes.'},403);
  if(!/^application\/json(?:$|\s*;)/i.test(request.headers.get('content-type')||''))
    return json({error:'Send JSON search fields.'},415);
  if(active>=12)return json({error:'Search is busy. Try again shortly.'},429);
  let value;
  try {
    const body=await boundedBody(request);
    if(body===null)return json({error:'Search fields are too long.'},413);
    value=JSON.parse(body);
  }catch{return json({error:'Invalid search fields.'},400)}
  if(!value||typeof value!=='object'||Array.isArray(value))return json({error:'Enter an employer and job title.'},400);
  const {employer,title,profession=''}=value;
  if(typeof employer!=='string'||!employer.trim()||employer.length>160||
    typeof title!=='string'||!title.trim()||title.length>120||
    typeof profession!=='string'||(profession!==''&&!/^[a-z0-9-]{1,80}$/.test(profession)))
    return json({error:'Enter an employer and job title.'},400);
  active++;
  try{
    const result=await search({employer:employer.trim(),title:title.trim(),profession,signal:request.signal});
    return json(result);
  }catch{return json({error:'The workplace search could not finish.'},503)}
  finally{active--}
}
export default {fetch(request){return handleResearch(request)}};
