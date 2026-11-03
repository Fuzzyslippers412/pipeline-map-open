// Preserve the precision that the publisher supplied. Index-refresh dates have
// their own field and must never become the date of a historical event.
export function sourceDate(value, basis, detail) {
  let input = String(value ?? '').trim();
  const us = /^(\d{1,2})\/(\d{1,2})\/(\d{4})$/.exec(input);
  if (us) input = us[3]+'-'+us[1].padStart(2,'0')+'-'+us[2].padStart(2,'0');
  if (!/^\d{4}(?:-\d{2}(?:-\d{2})?)?$/.test(input)) return {dateBasis:'unknown'};
  const complete = input.length === 4 ? input+'-01-01' : input.length === 7 ? input+'-01' : input;
  const date = new Date(complete+'T00:00:00Z');
  if (!Number.isFinite(date.getTime()) || date.toISOString().slice(0,10)!==complete) return {dateBasis:'unknown'};
  return {publishedOn:input,dateBasis:basis,dateDetail:detail};
}
