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
  if (!title || !allowedSlug.test(slug)) return null;
  const match = value.match === 'related' ? 'related' : 'title';
  return { title, workplace, slug, match };
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

export function findWorkplaceLinks(workplace, slug, links) {
  const key = workplaceKey(workplace);
  if (!key || !Array.isArray(links)) return [];
  return links.filter(item => item.professions.includes(slug) &&
    [item.workplace, ...item.aliases].some(alias => workplaceKey(alias) === key));
}
