export function createBattleAudio(
  AudioContextClass = globalThis.AudioContext ?? globalThis.webkitAudioContext,
) {
  let context = null;
  let enabled = true;
  let activation = Promise.resolve();
  let sequence = 0;
  const voices = new Set();

  function stop() {
    sequence++;
    for (const { oscillator, gain } of voices) {
      try {
        oscillator.stop();
      } catch {
        // A partially initialized voice may not have started.
      }
      oscillator.disconnect();
      gain.disconnect();
    }
    voices.clear();
  }

  function unlock() {
    if (!enabled || !AudioContextClass) return;
    try {
      context ??= new AudioContextClass();
      if (context.state === 'suspended' || context.state === 'interrupted') {
        activation = Promise.resolve(context.resume()).catch(() => {});
      }
    } catch {
      // Audio restrictions must never interrupt gameplay.
    }
  }

  function tone(frequency, endFrequency, delay, duration, volume, type) {
    const oscillator = context.createOscillator();
    const gain = context.createGain();
    const start = context.currentTime + delay;
    oscillator.type = type;
    oscillator.frequency.setValueAtTime(frequency, start);
    oscillator.frequency.exponentialRampToValueAtTime(endFrequency, start + duration);
    gain.gain.setValueAtTime(0.0001, start);
    gain.gain.linearRampToValueAtTime(volume, start + 0.01);
    gain.gain.exponentialRampToValueAtTime(0.0001, start + duration);
    oscillator.connect(gain);
    gain.connect(context.destination);
    const voice = { oscillator, gain };
    voices.add(voice);
    oscillator.onended = () => {
      oscillator.disconnect();
      gain.disconnect();
      voices.delete(voice);
    };
    oscillator.start(start);
    oscillator.stop(start + duration);
  }

  function play(kind) {
    const request = ++sequence;
    if (!enabled || !context || !['hit', 'sunk'].includes(kind)) return;
    const activeContext = context;
    function emit() {
      if (
        request !== sequence ||
        !enabled ||
        context !== activeContext ||
        context.state !== 'running'
      )
        return;
      try {
        tone(180, 45, 0, 0.22, 0.12, 'triangle');
        tone(720, 90, 0, 0.12, 0.065, 'sine');
        if (kind === 'sunk') {
          tone(120, 40, 0.14, 0.55, 0.14, 'triangle');
          tone(240, 60, 0.3, 0.4, 0.1, 'sine');
          tone(90, 30, 0.42, 0.4, 0.12, 'sine');
        }
      } catch {
        stop();
      }
    }
    if (context.state === 'running') emit();
    else void activation.then(emit);
  }

  return {
    unlock,
    play,
    stop,
    setEnabled(value) {
      enabled = value;
      if (!enabled) stop();
    },
    dispose() {
      stop();
      const previous = context;
      context = null;
      if (previous) void Promise.resolve(previous.close()).catch(() => {});
    },
  };
}
