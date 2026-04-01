/**
 * Marks a mute action as extension-initiated, then clears the flag once
 * the DOM has had time to settle. Uses a two-phase approach:
 *   1. requestAnimationFrame — waits for the next paint (DOM update applied)
 *   2. setTimeout 120ms — extra buffer for Meet's async attribute updates
 * Falls back to 600ms max timeout in case rAF never fires (background tab).
 */
export function markExtensionMuteAction(action: () => void, clearFlag: () => void) {
  action();

  let cleared = false;
  const clear = () => {
    if (cleared) return;
    cleared = true;
    clearFlag();
  };

  // Wait for the next animation frame + a short buffer
  requestAnimationFrame(() => {
    setTimeout(clear, 120);
  });

  // Fallback: clear after 600ms max (e.g. if tab is in background and rAF is throttled)
  setTimeout(clear, 600);
}
