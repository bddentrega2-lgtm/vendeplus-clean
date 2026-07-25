let lastPlayedAt = 0;
let audioContext: AudioContext | null = null;

function getAudioContext() {
  if (typeof window === "undefined") return null;
  const AudioContextClass = window.AudioContext || (window as any).webkitAudioContext;
  if (!AudioContextClass) return null;
  if (!audioContext) audioContext = new AudioContextClass();
  return audioContext;
}

export async function unlockOrderNotificationSound() {
  try {
    const context = getAudioContext();
    if (!context) return;
    if (context.state === "suspended") await context.resume();
  } catch {
    // Browsers may still block audio until a direct user gesture.
  }
}

export async function playNewOrderSound() {
  if (typeof window === "undefined") return;

  const now = Date.now();
  if (now - lastPlayedAt < 1800) return;
  lastPlayedAt = now;

  try {
    const context = getAudioContext();
    if (!context) return;
    if (context.state === "suspended") await context.resume();

    const gain = context.createGain();
    gain.gain.setValueAtTime(0.0001, context.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.28, context.currentTime + 0.02);
    gain.gain.exponentialRampToValueAtTime(0.0001, context.currentTime + 0.75);
    gain.connect(context.destination);

    for (const [index, frequency] of [740, 980, 1240].entries()) {
      const oscillator = context.createOscillator();
      oscillator.type = "sine";
      oscillator.frequency.setValueAtTime(frequency, context.currentTime);
      oscillator.connect(gain);
      oscillator.start(context.currentTime + index * 0.16);
      oscillator.stop(context.currentTime + index * 0.16 + 0.2);
    }
  } catch {
    // Some browsers block audio until the user interacts with the page.
  }
}
