/**
 * Subtle audio feedback using Web Audio API.
 * Synthesizes a warm, harmonic success chime on the client side without
 * requiring external audio files, ensuring instant playback even in offline mode.
 */

let sharedAudioContext: AudioContext | null = null;

function getAudioContext(): AudioContext | null {
  if (typeof window === 'undefined') return null;
  const AudioContextClass =
    window.AudioContext ||
    (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;

  if (!AudioContextClass) return null;

  if (!sharedAudioContext || sharedAudioContext.state === 'closed') {
    sharedAudioContext = new AudioContextClass();
  }

  // Resume context if browser suspended it prior to user interaction
  if (sharedAudioContext.state === 'suspended') {
    sharedAudioContext.resume().catch(() => {});
  }

  return sharedAudioContext;
}

/**
 * Plays a warm, subtle 4-note ascending harmonic success chime (C5 -> E5 -> G5 -> C6).
 */
export function playSuccessChime(): void {
  try {
    const ctx = getAudioContext();
    if (!ctx) return;

    // Harmonic frequencies in Hertz (C major chord ascending to high sparkle)
    const notes = [
      { freq: 523.25, timeOffset: 0.0, duration: 0.35, gain: 0.12 }, // C5
      { freq: 659.25, timeOffset: 0.08, duration: 0.38, gain: 0.14 }, // E5
      { freq: 783.99, timeOffset: 0.16, duration: 0.42, gain: 0.15 }, // G5
      { freq: 1046.5, timeOffset: 0.24, duration: 0.75, gain: 0.18 }, // C6
    ];

    const startTime = ctx.currentTime;

    // Master volume limiter to keep the chime gentle and subtle
    const masterGain = ctx.createGain();
    masterGain.gain.setValueAtTime(0.7, startTime);
    masterGain.connect(ctx.destination);

    notes.forEach(({ freq, timeOffset, duration, gain }) => {
      const osc = ctx.createOscillator();
      const noteGain = ctx.createGain();

      // Sine wave for pure, warm bell-like tone
      osc.type = 'sine';
      osc.frequency.setValueAtTime(freq, startTime + timeOffset);

      // Envelope: soft attack, natural exponential decay
      const noteStart = startTime + timeOffset;
      const noteEnd = noteStart + duration;

      noteGain.gain.setValueAtTime(0.0001, noteStart);
      noteGain.gain.exponentialRampToValueAtTime(gain, noteStart + 0.02);
      noteGain.gain.exponentialRampToValueAtTime(0.0001, noteEnd);

      osc.connect(noteGain);
      noteGain.connect(masterGain);

      osc.start(noteStart);
      osc.stop(noteEnd);
    });
  } catch (err) {
    // Graceful fallback if Web Audio is unsupported or blocked by OS audio policy
    console.debug('Success chime audio playback skipped:', err);
  }
}
