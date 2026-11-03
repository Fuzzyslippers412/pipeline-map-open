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
  const trace = {title, workplace, slug, match, workplaceInfo};
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

export function findWorkplaceLinks(workplace, slug, links, workplaceInfo = null) {
  const key = workplaceKey(workplace);
  if (!key || !Array.isArray(links)) return [];
  return links.filter(item => {
    if (!item.professions.includes(slug)) return false;
    const names = [item.workplace, ...item.aliases].map(workplaceKey);
    if (!item.site) return names.includes(key);

    // School names recur across districts. A selected directory row must match
    // both its location and its district. Bare free text cannot establish a site.
    const info = workplaceInfo?.workplace === workplace ? workplaceInfo : null;
    if (info && (info.location || info.parent)) {
      const location = workplaceKey(item.site.location);
      if (workplaceKey(info.location) !== location ||
          workplaceKey(info.parent) !== workplaceKey(item.site.parent)) return false;
      if (names.includes(key + ' ' + location)) return true;
    }
    return names.includes(key); // Every stored school alias includes its city and state.
  });
}
