export const activities = [
  {id:'fix', label:'Fixing things', detail:'Get something working again.'},
  {id:'explain', label:'Explaining', detail:'Help someone understand.'},
  {id:'care', label:'Caring', detail:'Look after someone.'},
  {id:'design', label:'Designing', detail:'Dream up and make something.'},
  {id:'investigate', label:'Investigating', detail:'Figure out how or why.'},
  {id:'organize', label:'Organizing', detail:'Put a plan in order.'}
];

const labels = new Map(activities.map(activity => [activity.id,activity.label.toLowerCase()]));

function matchingLabels(tags, selected) {
  return tags.filter(tag => selected.includes(tag)).map(tag => labels.get(tag)).filter(Boolean);
}

const readable = items => new Intl.ListFormat('en', {style:'long', type:'conjunction'}).format(items);

function reason(known, curious) {
  if (known.length && curious.length)
    return 'You already help with ' + readable(known) + '. You want to try ' + readable(curious) + '.';
  if (known.length) return 'You chose ' + readable(known) + ' as something you already do.';
  if (curious.length) return 'You said you would like to try ' + readable(curious) + '.';
  return '';
}

// Give a student who skips both questions different kinds of work to sample.
// If only one record connects, the second is explicitly labeled as another possibility.
export function exploreActivities(records, known = [], curious = []) {
  const candidates = records.map((record,index) => {
    const first = matchingLabels(record.tags, known);
    const second = matchingLabels(record.tags, curious);
    return {id:record.id, index, tags:record.tags, overlap:first.length + second.length,
      both:Boolean(first.length && second.length), why:reason(first, second)};
  });
  const matches = candidates.filter(row => row.overlap)
    .sort((a,b) => Number(b.both)-Number(a.both) || b.overlap-a.overlap || a.index-b.index)
    .slice(0,3);
  const target = Math.min(known.length || curious.length ? 2 : 3, records.length);
  while (matches.length < target) {
    const seen = new Set(matches.flatMap(row => row.tags));
    const unused = candidates.filter(row => !matches.some(match => match.id === row.id));
    const fresh = row => row.tags.filter(tag => !seen.has(tag)).length;
    unused.sort((a,b) => fresh(b)-fresh(a) || a.index-b.index);
    const pick = matches.length ? unused[0] : candidates[0];
    matches.push({...pick,why:known.length || curious.length
      ? 'Another kind of work you could try alongside your activity choices.'
      : 'A starting point to sample while you explore.'});
  }
  return matches.map(({id,why}) => ({id,why}));
}
