import primary from '../../../../data/workplace-directory.json' with {type:'json'};
import schools from '../../../../data/workplace-schools.json' with {type:'json'};
import evidence from '../../../../data/discovery-index.json' with {type:'json'};
import reviewed from '../../../../data/workplace-links.json' with {type:'json'};
import {normalizeEmployerText} from '../../../lib/employer-key.js';
import {packDirectory} from '../../../lib/workplace-search.js';

export function getStaticPaths(){return ['main','schools'].map(part=>({params:{part}}))}
export function GET({params:{part}}){
  const sites=new Map();
  for(const row of reviewed.filter(row=>row.site)){
    sites.set(row.site.id,[...(sites.get(row.site.id)||[]),row.workplace,...row.aliases]);
  }
  if(part==='schools'){
    const records=schools.records.map(school=>{
      const entry=sites.get(school.id);
      return entry?{...school,priority:2,aliases:[...new Set([...(school.aliases||[]),...entry])]}:school;
    });
    return Response.json(packDirectory(records,schools.sources));
  }
  const verified=new Map(reviewed.filter(row=>!row.site).map(row=>[normalizeEmployerText(row.workplace),row]));
  const known=new Set();
  const parentNames=new Set(primary.records.filter(row=>row.parent&&(verified.has(normalizeEmployerText(row.name))||row.source?.startsWith('verified-'))).map(row=>normalizeEmployerText(row.parent)));
  const records=primary.records.map(row=>{
    const norm=normalizeEmployerText(row.name);
    known.add(norm);
    const entry=verified.get(norm), site=sites.get(row.id);
    return {...row,priority:entry||site||row.source?.startsWith('verified-')?2:parentNames.has(norm)?1:0,
      aliases:entry||site?[...new Set([...(row.aliases||[]),...(entry?.aliases||[]),...(site||[])])]:row.aliases};
  });
  for(const [key,row] of verified){
    if(!known.has(key)){records.push({name:row.workplace,aliases:row.aliases,reviewed:true});known.add(key)}
  }
  for(const row of evidence.records){
    const key=normalizeEmployerText(row.issuer);
    if(!key||known.has(key))continue;
    known.add(key);records.push({name:row.issuer,kind:'Federal award recipient'});
  }
  return Response.json(packDirectory(records,primary.sources));
}
