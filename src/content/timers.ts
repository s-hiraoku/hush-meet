export function clearTimer(timerId: ReturnType<typeof setTimeout> | null) {
  if (timerId) {
    clearTimeout(timerId);
  }
  return null;
}

export function clearIntervalTimer(timerId: ReturnType<typeof setInterval> | null) {
  if (timerId) {
    clearInterval(timerId);
  }
  return null;
}
