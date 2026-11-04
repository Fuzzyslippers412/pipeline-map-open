export function filterDiscovery(records,filters={}){
 const query=(filters.query||'').trim().toLocaleLowerCase();
 return records.filter(record=>(!query||(record.name+' '+record.related+' '+record.sector).toLocaleLowerCase().includes(query))&&
  (!filters.sector||record.sector===filters.sector)&&(!filters.country||record.countries.includes(filters.country))&&
  (!filters.education||record.education===filters.education)&&(!filters.institution||record.institutions.includes(filters.institution))&&
  (!filters.ownership||record.ownership)&&(!filters.period||record.years.some(year=>filters.period==='before1900'?year<1900:filters.period==='1900-1964'?year>=1900&&year<1965:year>=1965)));
}
