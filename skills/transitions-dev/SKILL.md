---
name: "transitions-dev"
description: >
  Production-ready CSS & Motion transition patterns for web applications by Jakub Antalik (transitions.dev).
  Provides 12 crafted transition patterns with semantic CSS custom properties, natural spring curves,
  sheet/drawer physics, card expansions, number pop-ins, modal scale transitions, and accessible prefers-reduced-motion guards.
---

# Transitions.dev Motion & Transitions System
Created by Jakub Antalik (https://transitions.dev)

## 1. Core Tokens & Timing Vocabulary

```css
:root {
  --t-ease-standard: cubic-bezier(0.2, 0, 0, 1);
  --t-ease-decelerate: cubic-bezier(0, 0, 0, 1);
  --t-ease-accelerate: cubic-bezier(0.3, 0, 1, 1);
  --t-ease-spring: cubic-bezier(0.175, 0.885, 0.32, 1.275);
  --t-ease-soft-spring: cubic-bezier(0.16, 1, 0.3, 1);
  --t-ease-bounce: cubic-bezier(0.34, 1.56, 0.64, 1);
  --t-dur-instant: 120ms;
  --t-dur-fast: 200ms;
  --t-dur-normal: 280ms;
  --t-dur-smooth: 380ms;
  --t-dur-slow: 480ms;
}

@media (prefers-reduced-motion: reduce) {
  *, *::before, *::after {
    animation-duration: 0.01ms !important;
    animation-iteration-count: 1 !important;
    transition-duration: 0.01ms !important;
  }
}
```

## 2. The 12 Transitions.dev Patterns

1. **Modal Open / Close (`t-modal`)**: Scale-up with spring physics (0.94 -> 1.0) and soft scale-down on dismiss.
2. **Panel / Drawer Reveal (`t-panel`, `t-sheet`)**: Smooth slide-in from bottom or side with gentle blur crossfade.
3. **Card Expand / Accordion (`t-card-expand`)**: Organic height expansion without layout jumps.
4. **Number Pop-in (`t-num-pop`)**: Digit roll / blurred slide on currency and metric updates.
5. **Notification & Badge Pop (`t-badge-pop`)**: Spring scale pop for counters and badges.
6. **Text States Swap (`t-text-swap`)**: In-place vertical swap with micro-blur.
7. **Menu / Dropdown Origin Growth (`t-dropdown`)**: Origin-aware scale-down to scale-up from anchor.
8. **View & Route Transitions (`t-page-slide`)**: Lateral cross-slide between list and detail views.
9. **Icon Morph & Swap (`t-icon-swap`)**: Micro-rotation + scale fade between icons (e.g. check/circle, eye/eye-off).
10. **Success Check Celebration (`t-success-check`)**: Tactile spring pop with checkmark confirmation.
11. **Interactive Element Feedback (`t-press`)**: Haptic scale-down on active press (`scale(0.97)`).
12. **Tactile Error Shake (`t-shake`)**: Multi-frequency lateral micro-shake on invalid action.
