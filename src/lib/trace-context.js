// The canonical profession URL stays shareable. Personal inputs live only in this tab.
const key = 'pipeline-map:career-trace:v1';
const allowedSlug = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;

function boundedText(value, maxLength) {
  return typeof value === 'string' ? value.trim().slice(0, maxLength) : '';
}

function cleanTrace(value) {
  if (!value || typeof value !== 'object') return null;
  const title = boundedText(value.title, 120);
  const workplace = boundedText(value.workplace, 160);
  const slug = boundedText(value.slug, 80);
  const unmapped=value.match==='unmapped' && slug==='';
  if (!title || (!unmapped && !allowedSlug.test(slug))) return null;
  const match = unmapped ? 'unmapped' : value.match === 'related' ? 'related' : 'title';
  const info=value.workplaceInfo;
  const workplaceInfo=workplace && info?.workplace===workplace ? {
    workplace,parent:boundedText(info.parent,200),relation:boundedText(info.relation,70),location:boundedText(info.location,160)
  } : null;
  if(workplaceInfo){
    if(typeof info.id==='string'&&/^[a-zA-Z0-9][a-zA-Z0-9._:-]{0,199}$/.test(info.id))workplaceInfo.id=info.id;
    try{const url=new URL(info.sourceUrl);if(url.protocol==='https:'&&!url.username&&!url.password)workplaceInfo.sourceUrl=url.href}catch{}
    if(info.entered&&info.entered!==workplace)workplaceInfo.entered=boundedText(info.entered,160);
  }
  const trace = {title, workplace, slug, match, workplaceInfo};
  if(['sre','devops','software','systems','database','security','support','networkSupport','computing'].includes(value.contextKey))trace.contextKey=value.contextKey;
  if(typeof value.occupationCode==='string'&&/^\d{2}-\d{4}\.\d{2}$/.test(value.occupationCode))trace.occupationCode=value.occupationCode;
  if(typeof value.projectSector==='string' && /^[a-z]{1,16}$/.test(value.projectSector)) trace.projectSector=value.projectSector;
  const lookupTitle = boundedText(value.lookupTitle, 120);
  if (lookupTitle && lookupTitle !== title) trace.lookupTitle = lookupTitle;
  if (Array.isArray(value.choicePath)) {
    const path = value.choicePath.slice(0, 4).map(label => boundedText(label, 120)).filter(Boolean);
    if (path.length) trace.choicePath = path;
  }
  return trace;
}

export function readTrace() {
  try {
    return cleanTrace(JSON.parse(window.sessionStorage.getItem(key)));
  } catch {
    return null;
  }
}

export function saveTrace(value) {
  const trace = cleanTrace(value);
  if (!trace) return false;
  try {
    window.sessionStorage.setItem(key, JSON.stringify(trace));
    return true;
  } catch {
    return false;
  }
}

export function clearTrace() {
  try { window.sessionStorage.removeItem(key); } catch { /* Storage may be disabled. */ }
}

function workplaceKey(value) {
  return boundedText(value, 160).normalize('NFKD').replace(/\p{M}/gu, '').toLowerCase()
    .replace(/&/g, ' and ').replace(/[’']/g, '').replace(/[^\p{L}\p{N}]+/gu, ' ').trim();
}

export function findWorkplaceLinks(workplace, slug, links, workplaceInfo = null, {related=false,occupationCode='',contextKey=''} = {}) {
  const key = workplaceKey(workplace);
  if (!key || !Array.isArray(links)) return [];
  return links.filter(item => {
    if (!item.professions.includes(slug)) return false;
    // A broad field may contain unrelated jobs. A role-scoped record can only
    // apply when the reader selected an occupation it actually documents.
    const selectedRole=item.contextKeys?.includes(contextKey);
    const selectedOccupation=(item.occupationCodes||item.relatedOccupationCodes)?.includes(occupationCode);
    if(item.contextKeys && !selectedRole)return false;
    if(item.occupationCodes && !item.occupationCodes.includes(occupationCode))return false;
    if(related && !selectedOccupation && !selectedRole)return false;
    const names = [item.workplace, ...(item.aliases||[])].map(workplaceKey);
    if (!item.site) return names.includes(key);

    // School names recur across districts. A selected directory row must match
    // both its location and its district. Bare free text cannot establish a site.
    const info = workplaceInfo?.workplace === workplace ? workplaceInfo : null;
    // A selected identifier outranks a name. A conflicting ID must never fall
    // through to a same-name record in another town or organization.
    if(info?.id && item.site.id)return info.id===item.site.id;
    if (info && (info.location || info.parent)) {
      const location = workplaceKey(item.site.location);
      if (workplaceKey(info.location) !== location ||
          workplaceKey(info.parent) !== workplaceKey(item.site.parent)) return false;
      if (names.includes(key + ' ' + location)) return true;
    }
    return names.includes(key); // Every stored school alias includes its city and state.
  });
}
