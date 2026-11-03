// Compare institutional names without treating a parent and its subsidiary as
// the same workplace. Ignore only a leading article and common legal suffixes.
export const normalizeEmployerText = value => String(value||'').normalize('NFKD')
  .replace(/\p{M}/gu,'').toLowerCase().replace(/&/g,' and ').replace(/[’']/g,'')
  .replace(/[^\p{L}\p{N}]+/gu,' ').trim();
export const employerKey = value => normalizeEmployerText(value).replace(/^(?:the )/,'')
  .replace(/ (?:incorporated|corporation|inc|llc|plc)$/,'').trim();
