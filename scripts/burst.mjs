import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
import fs from 'node:fs/promises';
import http from 'node:http';
import {performance} from 'node:perf_hooks';
import path from 'node:path';
import {professions} from '../src/lib/model.js';

// Exercise the built artifact on loopback only. The client verifies the body
// digest, so a fast fallback page in place of an asset counts as a failure.
const total=10_000, concurrency=32, deadlineMs=90_000, perRequestMs=5000;
const dist=path.resolve('dist');
const comboSets=[
  ['physician'],
  ['lawyer','physician'],
  ['engineer','physician','registered-nurse'],
  ['elected-official','nonprofit-executive','pastor'],
];
const routes=['/','/sources/','/method/','/compare/','/data/compare.json','/cover.png','/atlas.svg','/mark.svg'];
for(const p of professions) routes.push('/p/'+p.slug+'/','/p/'+p.slug+'/og.png');
for(const picks of comboSets) {
  const ids=[...picks].sort();
  const share='/comparisons/'+ids.join('~')+'/';
  routes.push(share,share+'og.png','/compare/?p='+ids.join(','));
}
const assets=await fs.readdir(path.join(dist,'_astro'));
for(const ext of ['.js','.woff2']) {
  const asset=assets.find(s=>s.endsWith(ext));
  assert.ok(asset,'Missing representative '+ext+' asset');
  routes.push('/_astro/'+asset);
}
const routeFiles=new Map(), hashes=new Map();
for(const route of routes) {
  const pathname=new URL(route,'http://127.0.0.1').pathname;
  const file=path.join(dist,pathname.endsWith('/')?pathname+'index.html':pathname);
  const bytes=await fs.readFile(file);
  assert.ok(bytes.length>0,file);
  routeFiles.set(route,file);
  hashes.set(route,createHash('sha256').update(bytes).digest('hex'));
}

const server=http.createServer(async(req,res)=>{
  const file=routeFiles.get(req.url);
  if(req.method!=='GET'||!file) { res.writeHead(404).end(); return; }
  try {
    const body=await fs.readFile(file);
    res.writeHead(200,{'Content-Length':body.length}).end(body);
  } catch { res.writeHead(500).end(); }
});
await new Promise((resolve,reject)=>{ server.once('error',reject); server.listen(0,'127.0.0.1',resolve); });
const address=server.address();
assert.equal(address.address,'127.0.0.1');
const agent=new http.Agent({keepAlive:true,maxSockets:concurrency});
const latencies=[], errors=[];
let next=0, traffic=0;
const started=performance.now();
function request(route) {
  return new Promise((resolve,reject)=>{
    const req=http.get({hostname:'127.0.0.1',port:address.port,path:route,agent},res=>{
      const hash=createHash('sha256');
      res.on('data',chunk=>{ traffic+=chunk.length; hash.update(chunk); });
      res.on('aborted',()=>reject(Error('aborted response')));
      res.on('error',reject);
      res.on('end',()=>{
        if(res.statusCode!==200||hash.digest('hex')!==hashes.get(route)) reject(Error('status or response hash mismatch'));
        else resolve();
      });
    });
    const timeout=setTimeout(()=>req.destroy(Error('request timeout')),perRequestMs);
    req.on('close',()=>clearTimeout(timeout));
    req.on('error',reject);
  });
}
async function runner() {
  while(next<total&&performance.now()-started<deadlineMs) {
    const i=next++;
    const route=routes[i%routes.length],ts=performance.now();
    try { await request(route); }
    catch(error) { errors.push({route,message:error.message}); }
    latencies.push(performance.now()-ts);
  }
}
try {
  await Promise.all(Array.from({length:concurrency},runner));
} finally {
  agent.destroy();
  await new Promise(resolve=>server.close(resolve));
}
latencies.sort((a,b)=>a-b);
const elapsed=(performance.now()-started)/1000, p95=latencies[Math.ceil(latencies.length*.95)-1]||0;
const missed=total-latencies.length, failures=errors.length+missed;
console.log(JSON.stringify({target:'loopback static artifact',requests:total,completed:latencies.length,
  successes:latencies.length-errors.length,errors:failures,unattempted:missed,concurrency,
  representative_urls:routes.length,bytes_received:traffic,elapsed_s:+elapsed.toFixed(2),
  p95_ms:+p95.toFixed(2),requests_per_second:+(latencies.length/elapsed).toFixed(1),
  ...(failures?{first_errors:errors.slice(0,3)}:{})},null,2));
if(failures) process.exitCode=1;
