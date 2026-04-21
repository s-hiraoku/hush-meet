/**
 * Marks a mute action as extension-initiated, then clears the flag once
 * the DOM has had time to settle. The flag must stay set strictly longer than
 * the MutationObserver debounce window in index.ts, otherwise the observer
 * can misinterpret the extension's own click as a manual user mute and
 * silently switch the mode to Off.
 *
 * Timing: rAF + 500ms buffer, with a 1000ms hard fallback for background tabs
 * where rAF may be throttled.
 */
export function markExtensionMuteAction(action: () => void, clearFlag: () => void) {
  action();

  let cleared = false;
  const clear = () => {
    if (cleared) return;
    cleared = true;
    clearFlag();
  };

  requestAnimationFrame(() => {
    setTimeout(clear, 500);
  });

  setTimeout(clear, 1000);
}
