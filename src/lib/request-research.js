// An unhosted static export still supports public APIs that permit browser
// requests. Production routes searches through the same-origin Worker.
export async function requestResearch({employer,title,profession,signal}){
  const response=await fetch(import.meta.env.DEV?'/api/research/':'/api/research',{method:'POST',headers:{'Content-Type':'application/json'},
    body:JSON.stringify({employer,title,profession}),cache:'no-store',credentials:'omit',referrerPolicy:'no-referrer',signal});
  const isJson=(response.headers.get('Content-Type')||'').includes('application/json');
  if(!isJson && (response.ok || [404,405,501].includes(response.status))){
    const {discoverSources}=await import('./discover-sources.js');
    return discoverSources({employer,title,profession,signal});
  }
  if(!response.ok || !isJson)throw new Error('Live search could not finish');
  const report=await response.json();
  if(!Array.isArray(report.results)||!Array.isArray(report.providers))throw new Error('Invalid source response');
  return report;
}
