import { describe, expect, it, vi } from 'vitest';
import { createBattleAudio } from './audio.js';

function harness(state = 'running') {
  const parameter = () => ({
    setValueAtTime: vi.fn(),
    linearRampToValueAtTime: vi.fn(),
    exponentialRampToValueAtTime: vi.fn(),
  });
  const oscillators = [];
  const gains = [];
  const context = {
    state,
    currentTime: 10,
    destination: {},
    resume: vi.fn(async () => {
      await Promise.resolve();
      context.state = 'running';
    }),
    close: vi.fn(async () => {}),
    createOscillator: vi.fn(() => {
      const oscillator = {
        frequency: parameter(),
        connect: vi.fn(),
        disconnect: vi.fn(),
        start: vi.fn(),
        stop: vi.fn(),
      };
      oscillators.push(oscillator);
      return oscillator;
    }),
    createGain: vi.fn(() => {
      const gain = { gain: parameter(), connect: vi.fn(), disconnect: vi.fn() };
      gains.push(gain);
      return gain;
    }),
  };
  const Constructor = vi.fn(function () {
    return context;
  });
  return { audio: createBattleAudio(Constructor), context, Constructor, oscillators, gains };
}

describe('battle sound effects', () => {
  it('creates one context only when a user interaction unlocks audio', () => {
    const { audio, Constructor } = harness();
    audio.play('hit');
    expect(Constructor).not.toHaveBeenCalled();
    audio.unlock();
    audio.unlock();
    expect(Constructor).toHaveBeenCalledTimes(1);
  });
  it('plays a short, faded impact for a hit and disconnects finished voices', () => {
    const { audio, context, oscillators, gains } = harness();
    audio.unlock();
    audio.play('hit');
    expect(oscillators).toHaveLength(2);
    expect(oscillators[0].start).toHaveBeenCalledWith(10);
    expect(oscillators[0].stop).toHaveBeenCalledWith(10.22);
    expect(gains[0].gain.exponentialRampToValueAtTime).toHaveBeenCalledWith(0.0001, 10.22);
    expect(gains[0].connect).toHaveBeenCalledWith(context.destination);
    oscillators[0].onended();
    expect(oscillators[0].disconnect).toHaveBeenCalled();
    expect(gains[0].disconnect).toHaveBeenCalled();
  });
  it('adds a distinct longer descending sequence for a sinking hit', () => {
    const { audio, oscillators } = harness();
    audio.unlock();
    audio.play('sunk');
    expect(oscillators).toHaveLength(5);
    expect(oscillators[4].start).toHaveBeenCalledWith(10.42);
    expect(oscillators[4].stop).toHaveBeenCalledWith(10.82);
    expect(oscillators[4].frequency.exponentialRampToValueAtTime).toHaveBeenCalledWith(30, 10.82);
  });
  it('does not emit a sound for misses or unrelated events', () => {
    const { audio, oscillators } = harness();
    audio.unlock();
    for (const event of ['miss', null, 'setup']) audio.play(event);
    expect(oscillators).toHaveLength(0);
  });
  it('mutes active and future sounds immediately without replaying on unmute', () => {
    const { audio, oscillators, Constructor } = harness();
    audio.setEnabled(false);
    audio.unlock();
    expect(Constructor).not.toHaveBeenCalled();
    audio.setEnabled(true);
    audio.unlock();
    audio.play('sunk');
    audio.setEnabled(false);
    expect(oscillators.every((oscillator) => oscillator.disconnect.mock.calls.length)).toBe(true);
    audio.play('hit');
    audio.setEnabled(true);
    expect(oscillators).toHaveLength(5);
    audio.play('hit');
    expect(oscillators).toHaveLength(7);
  });
  it.each(['suspended', 'interrupted'])(
    'waits for a %s audio context to resume after a user gesture',
    async (state) => {
      const { audio, context, oscillators } = harness(state);
      let finish;
      context.resume.mockImplementation(
        () =>
          new Promise((resolve) => {
            finish = () => {
              context.state = 'running';
              resolve();
            };
          }),
      );
      audio.unlock();
      expect(context.resume).toHaveBeenCalledOnce();
      audio.play('hit');
      expect(oscillators).toHaveLength(0);
      finish();
      await Promise.resolve();
      await Promise.resolve();
      expect(oscillators).toHaveLength(2);
    },
  );
  it.each(['stop', 'dispose'])('cancels queued sounds on %s', async (action) => {
    const { audio, context, oscillators } = harness('suspended');
    audio.unlock();
    audio.play('hit');
    audio[action]();
    await Promise.resolve();
    await Promise.resolve();
    expect(oscillators).toHaveLength(0);
    if (action === 'dispose') expect(context.close).toHaveBeenCalledOnce();
  });
  it('does not break gameplay when audio is unavailable or blocked', async () => {
    for (const Constructor of [
      null,
      function () {
        throw new Error('Blocked');
      },
    ]) {
      const audio = createBattleAudio(Constructor);
      expect(() => {
        audio.unlock();
        audio.play('hit');
        audio.dispose();
      }).not.toThrow();
    }
    const { audio, context, oscillators } = harness('suspended');
    context.resume.mockRejectedValue(new Error('Not allowed'));
    audio.unlock();
    audio.play('hit');
    await Promise.resolve();
    await Promise.resolve();
    expect(oscillators).toHaveLength(0);
  });
});
