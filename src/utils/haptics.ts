// Haptic Feedback for Mobile Touch Interactions (Vibration API)

export function vibrate(pattern: number | number[] = 15): void {
  if (typeof window === 'undefined' || !window.navigator || !('vibrate' in window.navigator)) {
    return;
  }
  try {
    window.navigator.vibrate(pattern);
  } catch {
    // Ignore unsupported devices or silent failures
  }
}

export const hapticFeedback = {
  light: () => vibrate(12),
  medium: () => vibrate(22),
  heavy: () => vibrate(45),
  success: () => vibrate([15, 40, 20]),
  warning: () => vibrate([30, 50, 30]),
  selection: () => vibrate(8),
};
