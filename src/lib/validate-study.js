const sectionIds=['origins','builders','access','doors','authority','ownership','build'];
const evidenceKinds=['documented','interpretation','disputed','question'];
export function validateStudy(study){
 const errors=[];const require=(value,message)=>{if(!value)errors.push(message)};
 const ids=new Set();
 for(const source of study.sources||[]){
  require(!ids.has(source.id),'Duplicate source '+source.id);ids.add(source.id);
  for(const key of ['id','title','publisher','type','locator','checkedOn'])require(typeof source[key]==='string'&&source[key].trim(),'Source '+source.id+' needs '+key);
  try{const url=new URL(source.url);require(url.protocol==='https:'&&!url.username&&!url.password,'Unsafe source URL '+source.id)}catch{errors.push('Invalid URL '+source.id)}
  require(/^\d{4}-\d{2}-\d{2}$/.test(source.checkedOn),'Review date missing '+source.id);
  require(source.publishedOn===null||/^\d{4}(?:-\d{2})?(?:-\d{2})?$/.test(source.publishedOn),'Invalid publication date '+source.id);
 }
 const references=(record,label)=>{require(Array.isArray(record.sourceIds)&&record.sourceIds.length>0,label+' has no evidence');for(const id of record.sourceIds||[])require(ids.has(id),label+' has unknown source '+id);require(record.limit?.trim(),label+' has no limit')};
 const claims=new Set();
 for(const claim of study.claims||[]){
  require(!claims.has(claim.id),'Duplicate claim '+claim.id);claims.add(claim.id);
  require(sectionIds.includes(claim.section),'Unknown section '+claim.id);require(evidenceKinds.includes(claim.status),'Unclassified evidence '+claim.id);
  require(['us','cm','global'].includes(claim.country),'Missing country '+claim.id);
  for(const key of ['title','body','young','teen','period'])require(claim[key]?.trim(),'Claim '+claim.id+' needs '+key);
  references(claim,'Claim '+claim.id);
 }
 for(const id of sectionIds)require(study.claims.some(c=>c.section===id),'Empty section '+id);
 for(const row of study.comparison||[])for(const country of ['us','cm']){require(row[country]?.text?.trim(),'Missing comparison '+row.id+' '+country);if(row[country])references(row[country],'Comparison '+row.id+' '+country)}
 const edgeIds=new Set();
 for(const edge of study.map?.edges||[]){require(!edgeIds.has(edge.id),'Duplicate relationship '+edge.id);edgeIds.add(edge.id);require(['us','cm'].includes(edge.country),'Missing relationship country '+edge.id);require(['authority','money','care'].includes(edge.kind),'Unknown relationship '+edge.id);require(edge.from&&edge.to&&edge.from!==edge.to&&edge.text,'Incomplete relationship '+edge.id);references(edge,'Relationship '+edge.id)}
 for(const country of ['us','cm'])for(const kind of ['authority','money','care'])require(study.map.edges.some(e=>e.country===country&&e.kind===kind),'Missing '+country+' '+kind+' relationship');
 const milestones=new Set();for(const milestone of study.milestones||[]){require(!milestones.has(milestone.id),'Duplicate milestone '+milestone.id);milestones.add(milestone.id);require(claims.has(milestone.claimId),'Unlinked milestone '+milestone.id);require(Number.isInteger(milestone.year)&&milestone.date,'Undated milestone '+milestone.id)}
 for(const q of study.questions||[]){require(claims.has(q.claimId),'Unlinked learning question');require(q.options.filter(o=>o.supported).length===1,'Question needs one supported answer')}
 require(study.researchGaps?.length,'Missing research gaps');return errors;
}
