import { VOICE_FREQ_LOW, VOICE_FREQ_HIGH, VOICE_WEIGHT_EXPONENT } from "../constants.ts";

export function computeVoiceBins(
  sampleRate: number,
  fftSize: number,
): { start: number; end: number } {
  const binWidth = sampleRate / fftSize;
  return {
    start: Math.max(1, Math.round(VOICE_FREQ_LOW / binWidth)),
    end: Math.min(fftSize / 2 - 1, Math.round(VOICE_FREQ_HIGH / binWidth)),
  };
}

export function computeVoiceWeightedRms(
  rms: number,
  freqData: Uint8Array,
  voiceStartBin: number,
  voiceEndBin: number,
  exponent: number = VOICE_WEIGHT_EXPONENT,
): { weightedRms: number; voiceRatio: number } {
  let totalEnergy = 0;
  let voiceEnergy = 0;

  for (let i = 1; i < freqData.length; i++) {
    const val = freqData[i];
    const e = val * val;
    totalEnergy += e;
    if (i >= voiceStartBin && i <= voiceEndBin) {
      voiceEnergy += e;
    }
  }

  if (totalEnergy === 0) {
    return { weightedRms: 0, voiceRatio: 0 };
  }

  const voiceRatio = voiceEnergy / totalEnergy;
  const weightedRms = rms * Math.pow(voiceRatio, exponent);
  return { weightedRms, voiceRatio };
}
