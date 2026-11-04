// An explicit "Suggest a source" click hands a draft to this tab only.
// Nothing is placed in a URL or submitted to a public tracker here.
const key='door-notes:source-suggestion-draft';
export function cleanSuggestionDraft(value){
  if(!value||typeof value!=='object')return null;
  const site=typeof value.site==='string'?value.site.trim().slice(0,120):'';
  const profession=typeof value.profession==='string'?value.profession.trim().slice(0,100):'';
  return profession?{site,profession}:null;
}
export function saveSuggestionDraft(value){
  try{sessionStorage.setItem(key,JSON.stringify(cleanSuggestionDraft(value)))}catch{/* The blank form remains usable. */}
}
export function takeSuggestionDraft(){
  try{const value=sessionStorage.getItem(key);sessionStorage.removeItem(key);return cleanSuggestionDraft(JSON.parse(value))}catch{return null}
}
