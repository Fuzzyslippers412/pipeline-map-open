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
  else customElements.whenDefined(element.localName).then(apply);
}

// Focusing is reserved for a submitted trace. Re-rendering after research or
// restoring a saved draft should never pull a reader away from their place.
export function revealTimelinePreview(element){
  if(!element)return;
  customElements.whenDefined(element.localName).then(()=>requestAnimationFrame(()=>{
    if(element.isConnected&&!element.hidden)element.focusPreview();
  }));
}
