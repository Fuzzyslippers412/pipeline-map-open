const topics = {
  opening: ['field opening', 'Which dated event opened access to this profession, and what did it change?'],
  workplace: ['workplace connection', 'Which public record connects a workplace to this profession’s history? Identify the institution, decision and date the source supports.'],
  route: ['training or hiring route', 'Which published record documents a training or hiring route into this profession? Describe what the source establishes about that route.'],
};

// Field names come from the published profession record. This helper has no
// access to the visitor’s typed title, workplace, session or current URL.
export function gapSourceLink(kind, publishedFieldName) {
  const topic = Object.hasOwn(topics, kind) ? topics[kind] : null;
  if (!topic) return null;
  const [label, prompt] = topic;
  const record = publishedFieldName || 'Unmatched profession';
  const url = new URL('https://github.com/Fuzzyslippers412/pipeline-map-corrections/issues/new');
  url.searchParams.set('template', 'correction.yml');
  url.searchParams.set('record', record);
  url.searchParams.set('title', '[Source] ' + record + ' · ' + label);
  url.searchParams.set('issue', 'Gap in the ' + label + '.\n\n' + prompt);
  return {href:url.href, label:'Suggest a source for the ' + label + ' gap on GitHub'};
}
