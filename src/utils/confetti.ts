import confetti from 'canvas-confetti';

/**
 * Fires a joyful, refined confetti burst in brand colors (#E8590C, amber, emerald, gold)
 */
export const fireTaskCelebration = (originX: number = 0.5, originY: number = 0.6) => {
  try {
    confetti({
      particleCount: 45,
      spread: 60,
      origin: { x: originX, y: originY },
      colors: ['#5BC2E7', '#f59e0b', '#10b981', '#fbbf24', '#ffffff'],
      ticks: 180,
      gravity: 1.1,
      scalar: 0.9,
      disableForReducedMotion: true,
    });
  } catch {
    // Fallback gracefully if canvas is blocked
  }
};

/**
 * Fires a grand celebration for completing all tasks of the day or a weekly goal
 */
export const fireGrandCelebration = () => {
  try {
    const count = 200;
    const defaults = {
      origin: { y: 0.7 },
      colors: ['#5BC2E7', '#f59e0b', '#10b981', '#3b82f6', '#ec4899', '#ffffff'],
      disableForReducedMotion: true,
    };

    function fire(particleRatio: number, opts: confetti.Options) {
      confetti({
        ...defaults,
        ...opts,
        particleCount: Math.floor(count * particleRatio),
      });
    }

    fire(0.25, {
      spread: 26,
      startVelocity: 55,
    });
    fire(0.2, {
      spread: 60,
    });
    fire(0.35, {
      spread: 100,
      decay: 0.91,
      scalar: 0.8,
    });
    fire(0.1, {
      spread: 120,
      startVelocity: 25,
      decay: 0.92,
      scalar: 1.2,
    });
    fire(0.1, {
      spread: 120,
      startVelocity: 45,
    });
  } catch {
    // Graceful fallback
  }
};
