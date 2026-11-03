// This optional search is initiated by a button, never by typing a letter.
export async function searchRecipientNames(query,signal){
  const response=await fetch('https://api.usaspending.gov/api/v2/autocomplete/recipient/',{
    method:'POST',credentials:'omit',referrerPolicy:'no-referrer',signal,
    headers:{'Content-Type':'application/json',Accept:'application/json'},
    body:JSON.stringify({search_text:query.trim().slice(0,160),limit:10})
  });
  if(!response.ok)throw new Error('Directory unavailable');
  const body=await response.json();
  if(!Array.isArray(body.results))throw new Error('Unexpected directory response');
  const names=[...new Set(body.results.map(r=>r.recipient_name).filter(n=>typeof n==='string'&&n.trim()&&n.length<=160))];
  return names.map(name=>({value:name,label:name,detail:'Federal award recipient · USAspending'}));
}
