export function isMuteControlLabel(label: string): boolean {
  const normalized = label.toLowerCase();
  return (
    normalized.includes("microphone") ||
    normalized.includes("マイク") ||
    normalized.includes("ミュート") ||
    normalized.includes("mute") ||
    normalized.includes("unmute") ||
    normalized.includes("turn on microphone") ||
    normalized.includes("turn off microphone") ||
    normalized.includes("マイクをオンにする") ||
    normalized.includes("マイクをオフにする")
  );
}

export function inferMeetMutedFromLabel(label: string): boolean | null {
  const normalized = label.toLowerCase();
  if (
    normalized.includes("ミュートを解除") ||
    normalized.includes("unmute") ||
    normalized.includes("turn on microphone") ||
    normalized.includes("マイクをオンにする")
  ) {
    return true;
  }

  if (
    normalized.includes("ミュート") ||
    normalized.includes("mute") ||
    normalized.includes("turn off microphone") ||
    normalized.includes("マイクをオフにする")
  ) {
    return false;
  }

  return null;
}
