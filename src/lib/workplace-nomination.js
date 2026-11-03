export const trackerForm = 'https://github.com/Fuzzyslippers412/pipeline-map-corrections/issues/new?template=workplace.yml';

export function prepareNomination(values) {
  const fields = {};
  for (const key of ['site', 'city', 'state', 'profession', 'source']) {
    const text = String(values[key] || '').trim();
    if (key !== 'source' && !text) return {error: key};
    fields[key] = text;
  }
  if (fields.source) {
    try {
      const source = new URL(fields.source);
      if (!['http:', 'https:'].includes(source.protocol) || source.username || source.password) return {error: 'source'};
    } catch {
      return {error: 'source'};
    }
  }
  const title = '[Workplace] ' + fields.site + ' · ' + fields.city + ', ' + fields.state;
  const github = new URL(trackerForm);
  // GitHub reads these query parameter names from the issue form’s field IDs.
  github.searchParams.set('title', title);
  for (const [name, value] of Object.entries(fields)) {
    if (value) github.searchParams.set(name, value);
  }
  const summary = [
    'Door Notes workplace request',
    'Workplace: ' + fields.site,
    'Location: ' + fields.city + ', ' + fields.state,
    'Profession: ' + fields.profession,
    fields.source && 'Public source: ' + fields.source
  ].filter(Boolean).join('\n');
  return {fields, summary, github: github.href};
}
