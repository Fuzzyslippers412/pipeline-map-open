// Manual-selection combobox. Moving through the list never rewrites the input;
// only choosing a row commits a value. Ordinary submit always accepts free text.
export function attachTraceCombobox({input, popup, status, getOptions, onPick, getState = () => 'ready'}) {
  const doc = input.ownerDocument;
  const win = doc.defaultView;
  const listeners = new win.AbortController();
  let matches = [];
  let active = -1;
  let selected = null;
  let dismissed = null;
  let composing = false;
  let committing = false;

  popup.id ||= input.id + '-options';
  popup.classList.add('trace-combobox-popup');
  popup.setAttribute('role', 'listbox');
  popup.setAttribute('aria-label', input.labels?.[0]?.textContent.trim() || 'Suggestions');
  input.setAttribute('role', 'combobox');
  input.setAttribute('aria-autocomplete', 'list');
  input.setAttribute('aria-haspopup', 'listbox');
  input.setAttribute('aria-controls', popup.id);
  if (status) {
    status.classList.add('trace-combobox-status');
    status.setAttribute('role', 'status');
    status.setAttribute('aria-atomic', 'true');
  }

  const announce = message => {
    if (status && status.textContent !== message) status.textContent = message;
  };
  const optionKey = option => option && (option.key ?? [option.value, option.detail, option.location].join('\n'));

  function close() {
    dismissed = input.value;
    active = -1;
    popup.hidden = true;
    input.setAttribute('aria-expanded', 'false');
    input.removeAttribute('aria-activedescendant');
    announce('');
  }

  function fitPopup() {
    if (popup.hidden) return;
    const rect = input.getBoundingClientRect();
    const viewport = win.visualViewport;
    const viewportTop = viewport?.offsetTop || 0;
    const viewportBottom = viewportTop + (viewport?.height || win.innerHeight);
    const below = viewportBottom - rect.bottom - 8;
    const above = rect.top - viewportTop - 8;
    const flip = below < 210 && above > below;
    popup.dataset.side = flip ? 'above' : 'below';
    popup.style.setProperty('--trace-popup-space', Math.max(70, Math.floor(flip ? above : below)) + 'px');
  }

  function activate(index) {
    active = index;
    const row = popup.children[index];
    for (const child of popup.children) child.classList.toggle('is-active', child === row);
    if (!row) {
      input.removeAttribute('aria-activedescendant');
      return;
    }
    input.setAttribute('aria-activedescendant', row.id);
    // Scroll only the list. scrollIntoView can move the phone's entire page.
    const y = row.offsetTop;
    if (y < popup.scrollTop) popup.scrollTop = y;
    else if (y + row.offsetHeight > popup.scrollTop + popup.clientHeight)
      popup.scrollTop = y + row.offsetHeight - popup.clientHeight;
  }

  function rowFor(option, index) {
    const row = doc.createElement('div');
    row.id = popup.id + '-option-' + index;
    row.dataset.index = String(index);
    row.setAttribute('role', 'option');
    row.setAttribute('aria-selected', String(option !== null && selected !== null && optionKey(option) === selected));
    row.className = option ? 'trace-combobox-option' : 'trace-combobox-option trace-combobox-free';
    const label = doc.createElement('strong');
    label.textContent = option ? (option.label || option.value) : 'Use “' + input.value + '”';
    row.append(label);
    const detail = option ? [option.detail, option.location].filter(Boolean).join(' · ') :
      (matches.length ? 'Keep exactly what you typed' :
        getState()==='loading' ? 'Suggestions are loading. You can use this now.' :
        getState()==='unavailable' ? 'The directory could not fully load. Keep your own entry.' :
        'No matching suggestion. Keep exactly what you typed.');
    if (detail) {
      const secondary = doc.createElement('span');
      secondary.textContent = detail;
      row.append(secondary);
    }
    return row;
  }

  function refresh() {
    if (composing || input !== doc.activeElement || dismissed === input.value) return;
    if (input.value.trim().length < 2) { close(); return; }
    const oldKey = active < 0 ? undefined : optionKey(matches[active] || null);
    matches = (getOptions(input.value) || []).slice(0, 5);
    const rows = [...matches, null].map(rowFor);
    popup.replaceChildren(...rows);
    popup.hidden = false;
    input.setAttribute('aria-expanded', 'true');
    fitPopup();
    activate(oldKey === null ? matches.length : matches.findIndex(o => optionKey(o) === oldKey));
    announce(matches.length ? matches.length + (matches.length === 1 ? ' suggestion.' : ' suggestions.') +
      ' Use the arrow keys to review, or keep your own entry.' : (getState()==='loading'?'Loading suggestions.':getState()==='unavailable'?'Directory unavailable.':'No suggestions.')+' You can use what you typed.');
  }

  function choose(index) {
    if (index < 0 || index > matches.length || popup.hidden) return;
    const option = matches[index] || null;
    const previouslyTypedText = input.value;
    if (option) input.value = option.value;
    selected = optionKey(option);
    const exactText = input.value;
    close();
    committing = true;
    try {
      input.dispatchEvent(new win.Event('input', {bubbles: true}));
    } finally {
      committing = false;
    }
    onPick?.(option, exactText, previouslyTypedText);
    announce(option ? (option.label || option.value) + ' selected.' : 'Using the text you entered.');
  }

  function edit() {
    if (committing) return;
    selected = null;
    active = -1;
    dismissed = null;
    refresh();
  }

  function onKey(event) {
    if (composing || event.isComposing || event.keyCode === 229) return;
    if (event.key === 'Tab') { close(); return; }
    if (event.key === 'Escape' && !popup.hidden) {
      event.preventDefault();
      close();
      return;
    }
    if (event.key === 'Enter' && !popup.hidden) {
      if (active < 0) close();
      else { event.preventDefault(); choose(active); }
      return;
    }
    if (event.key !== 'ArrowDown' && event.key !== 'ArrowUp') return;
    if (popup.hidden) { dismissed = null; refresh(); }
    if (popup.hidden) return;
    event.preventDefault();
    const last = matches.length; // Final row is always the verbatim entry.
    const next = event.key === 'ArrowDown' ? (active >= last ? 0 : active + 1) : (active <= 0 ? last : active - 1);
    activate(next);
  }

  function openFromInput() { dismissed = null; refresh(); }
  const listen = (target, type, fn) => target?.addEventListener(type, fn, {signal: listeners.signal});
  listen(input, 'focus', openFromInput);
  listen(input, 'click', openFromInput);
  listen(input, 'input', edit);
  listen(input, 'blur', close);
  listen(input, 'keydown', onKey);
  listen(input, 'compositionstart', () => { composing = true; close(); });
  listen(input, 'compositionend', () => { composing = false; edit(); });
  // Retain textbox focus through mouse and touch selection. The click commits
  // after release, so a drag or cancelled touch doesn't accidentally pick a row.
  listen(popup, 'pointerdown', e => { if (e.button === 0) e.preventDefault(); });
  listen(popup, 'click', e => {
    const row = e.target.closest?.('[role="option"]');
    if (row && popup.contains(row)) choose(Number(row.dataset.index));
  });
  // With the list in normal flow, blurring here could move the submit button
  // between the pointer press and release. Let its click submit first.
  listen(input.form?.querySelector('button[type="submit"]'), 'pointerdown', event => {
    if (!popup.hidden && event.button === 0) event.preventDefault();
  });
  listen(input.form, 'submit', close);
  listen(input.form, 'reset', () => { selected = null; close(); });
  listen(win, 'resize', fitPopup);
  listen(win.visualViewport, 'resize', fitPopup);
  listen(win.visualViewport, 'scroll', fitPopup);
  close();
  if (input === doc.activeElement) openFromInput();
  return {close, open:openFromInput, refresh, destroy() { close(); listeners.abort(); }};
}
