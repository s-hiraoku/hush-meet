import { DEFAULT_CONFIG, SILENCE_RATIO } from "../constants.ts";

export type HushMeetConfig = {
  speechThreshold: number;
  silenceThreshold: number;
  gracePeriod: number;
};

export function normalizeConfig(
  config: Partial<HushMeetConfig> | null | undefined,
): HushMeetConfig {
  const speechThreshold = config?.speechThreshold ?? DEFAULT_CONFIG.speechThreshold;
  return {
    speechThreshold,
    silenceThreshold: speechThreshold * SILENCE_RATIO,
    gracePeriod: config?.gracePeriod ?? DEFAULT_CONFIG.gracePeriod,
  };
}

export function buildAudioConstraints(selectedMicDeviceId: string | null): MediaTrackConstraints {
  const audioConstraints: MediaTrackConstraints = {
    echoCancellation: true,
    noiseSuppression: false,
    autoGainControl: true,
  };

  if (selectedMicDeviceId) {
    audioConstraints.deviceId = { exact: selectedMicDeviceId };
  }

  return audioConstraints;
}
