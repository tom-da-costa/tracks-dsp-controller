// `use:portal`: moves an element to the end of <body>, out of its parent.
//
// For the popups opened from the tab rail: the rail scrolls (overflow: auto), and iOS Safari
// clips a position: fixed element to the scrolling box that contains it, so a popup there was
// invisible on an iPhone. Moved to <body>, it is positioned and stacked against the page.
//
// The element must be the only node of its block ({#if}), so that Svelte removes it wherever
// it is; the destroy below removes it anyway.

export function portal(node: HTMLElement): { destroy: () => void } {
  document.body.appendChild(node);
  return { destroy: () => node.remove() };
}
