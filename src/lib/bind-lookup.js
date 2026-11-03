// Keep the latest form state if the Astro component hasn't upgraded yet.
const current = new WeakMap();
export function bindLookup(element, context) {
  if (!element) return;
  current.set(element, context);
  const apply = () => {
    if (!element.isConnected || current.get(element) !== context) return;
    if (context) element.setContext(context);
    else element.reset();
  };
  if (typeof element.setContext === 'function') apply();
  else customElements.whenDefined('pipeline-source-lookup').then(apply);
}
