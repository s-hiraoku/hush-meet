export function markExtensionMuteAction(action: () => void, clearFlag: () => void) {
  action();
  setTimeout(() => {
    clearFlag();
  }, 500);
}
