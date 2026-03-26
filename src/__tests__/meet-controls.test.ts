import { describe, expect, it } from "vitest";
import { inferMeetMutedFromLabel, isMuteControlLabel } from "../meet-controls.ts";

describe("meet controls", () => {
  it("recognizes microphone control labels", () => {
    expect(isMuteControlLabel("Turn off microphone")).toBe(true);
    expect(isMuteControlLabel("マイクをオンにする")).toBe(true);
    expect(isMuteControlLabel("Chat with everyone")).toBe(false);
  });

  it("infers muted state from English labels", () => {
    expect(inferMeetMutedFromLabel("Turn on microphone")).toBe(true);
    expect(inferMeetMutedFromLabel("Turn off microphone")).toBe(false);
    expect(inferMeetMutedFromLabel("unmute")).toBe(true);
    expect(inferMeetMutedFromLabel("mute")).toBe(false);
  });

  it("infers muted state from Japanese labels", () => {
    expect(inferMeetMutedFromLabel("マイクをオンにする")).toBe(true);
    expect(inferMeetMutedFromLabel("マイクをオフにする")).toBe(false);
    expect(inferMeetMutedFromLabel("ミュートを解除")).toBe(true);
    expect(inferMeetMutedFromLabel("ミュート")).toBe(false);
  });

  it("returns null for unrelated labels", () => {
    expect(inferMeetMutedFromLabel("Raise hand")).toBeNull();
  });
});
