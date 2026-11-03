import {normalizeJobTitle} from './job-match.js';
import {attachTraceCombobox} from './trace-combobox.js';
import {suggestJobTitles} from './title-suggestions.js';
import {loadTitleDirectory, resolveTitle} from './title-resolver.js';

function matchesPrefix(term, query) {
  const words = normalizeJobTitle(term).split(' ');
  const parts = normalizeJobTitle(query).split(' ').filter(Boolean);
  if (!parts.length) return false;
  let next = 0;
  for (const word of words) {
    if (word.startsWith(parts[next]) && ++next === parts.length) return true;
  }
  return false;
}

export function bindProfessionIndex() {
  const form = document.querySelector('#index-search');
  if (!form) return;
  const catalog = JSON.parse(document.querySelector('#search-index').textContent);
  const input = form.querySelector('#occupation');
  const result = document.querySelector('#directory-match');
  const action = result.querySelector('.index-action');
  const tiles = [...document.querySelectorAll('#tiles [data-id]')];
  const filters = [...document.querySelectorAll('button[data-sector]')];
  const count = document.querySelector('#result-count');
  let sector = '';
  let directory = null;
  let directoryState = 'idle';

  function startTrace(title, lookupTitle) {
    if (!title.trim()) return;
    combo.close();
    document.dispatchEvent(new CustomEvent('doornotes:trace-title', {detail:{title, lookupTitle}}));
  }

  function update() {
    const query = input.value.trim();
    const match = query ? resolveTitle(query, catalog, directory) : null;
    const cards = catalog.filter(p => {
      if (sector && p.sector !== sector) return false;
      if (!query) return true;
      if (match.kind === 'exact') return p.slug === match.slug;
      if (match.kind !== 'unknown') return false;
      return [p.name, ...p.aliases].some(term => matchesPrefix(term, query));
    });
    const visible = new Set(cards.map(p => p.slug));
    for (const tile of tiles) tile.hidden = !visible.has(tile.dataset.id);
    document.querySelector('#empty').hidden = Boolean(cards.length) || Boolean(query && !sector);
    count.textContent = query && !cards.length && !sector ? 'Job title search' : cards.length + (cards.length === 1 ? ' profession' : ' professions');
    result.hidden = !query;
    form.querySelector('.index-go').hidden = !query;
    form.querySelector('kbd').hidden = Boolean(query);
    if (!query) return;

    const names = {
      exact: 'Published profession',
      related: 'Related field history',
      choices: 'Choose the work you do',
      recognized: 'Recognized occupation',
      unknown: 'Trace your wording'
    };
    const explanations = {
      exact: 'Open the profession’s history with the title you entered.',
      related: 'Explore the broader field and see which links to your job still need a source.',
      choices: match.question || 'This wording can describe several jobs. Choose the work that fits yours.',
      recognized: 'See which records are available for this occupation and where its history is still open.',
      unknown: 'Keep typing for suggestions, or keep this title and check what Door Notes can trace.'
    };
    result.querySelector('.directory-match-type').textContent = names[match.kind];
    result.querySelector('.directory-match-title').textContent = match.occupation || input.value.trim();
    result.querySelector('.directory-match-description').textContent = explanations[match.kind];
    action.textContent = match.kind === 'choices' ? 'Choose my work →' : 'Trace this title →';
  }

  function loadOnDemand() {
    if (directoryState !== 'idle' || input.value.trim().length < 2) return;
    directoryState = 'loading';
    loadTitleDirectory().then(value => {
      directory = value;
      directoryState = value ? 'ready' : 'unavailable';
      update();
      combo.refresh();
    });
  }

  const combo = attachTraceCombobox({
    input, popup: form.querySelector('#suggestions'), status: form.querySelector('#index-announcements'),
    getState: () => directoryState,
    getOptions: text => suggestJobTitles(text, catalog, directory || undefined).map(row => ({
      key:row.title, value:row.title, label:row.title, detail:row.subtitle
    })),
    onPick(option, committed, typed) {
      const original = typed?.trim() || committed;
      const recognized = resolveTitle(original, catalog, directory).kind !== 'unknown';
      startTrace(recognized ? original : committed, option?.value);
    }
  });
  input.addEventListener('input', () => { update(); loadOnDemand(); });
  form.addEventListener('submit', event => { event.preventDefault(); startTrace(input.value.trim()); });
  action.addEventListener('click', () => startTrace(input.value.trim()));
  document.querySelector('#tiles').addEventListener('click', event => {
    const tile = event.target.closest('.tile');
    if (!tile || !input.value.trim() || event.ctrlKey || event.metaKey || event.shiftKey || event.altKey) return;
    const match = resolveTitle(input.value, catalog, directory);
    if (match.kind === 'exact' && match.slug === tile.dataset.id) {
      event.preventDefault();
      startTrace(input.value.trim());
    }
  });
  for (const button of filters) button.addEventListener('click', () => {
    sector = button.dataset.sector;
    for (const item of filters) {
      item.classList.toggle('selected', item === button);
      item.setAttribute('aria-pressed', String(item === button));
    }
    update();
  });
  document.querySelector('#reset').addEventListener('click', () => {
    input.value = '';
    filters[0].click();
    input.focus();
  });
  document.addEventListener('keydown', event => {
    if (event.key === '/' && !['INPUT','SELECT','TEXTAREA'].includes(document.activeElement?.tagName) && !event.ctrlKey && !event.metaKey) {
      event.preventDefault();
      input.focus();
    }
  });
  update();
}
