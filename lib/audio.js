/**
 * Audio Utilities — Shared sound effects for barcode scanning.
 *
 * Provides a fileless, client-only beep sound synthesized via Web Audio API.
 */

/**
 * Play a crisp barcode scanner beep sound.
 * Safe to call from any client component — uses Web Audio API only (no files).
 */
export function playBeep() {
  try {
    const ctx = new (window.AudioContext || window.webkitAudioContext)();
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.connect(gain);
    gain.connect(ctx.destination);
    osc.type = 'sine';
    osc.frequency.value = 900;
    gain.gain.setValueAtTime(0, ctx.currentTime);
    gain.gain.linearRampToValueAtTime(0.15, ctx.currentTime + 0.03);
    gain.gain.linearRampToValueAtTime(0, ctx.currentTime + 0.12);
    osc.start(ctx.currentTime);
    osc.stop(ctx.currentTime + 0.12);
  } catch (e) {
    console.error('Failed to play beep:', e);
  }
}
