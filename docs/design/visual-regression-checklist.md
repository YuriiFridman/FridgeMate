# Visual Regression Checklist

Run this checklist before each release affecting UI.

## Core Screens
- Inventory: header wraps correctly, cards do not overflow, `Delete` is clickable on web/mobile.
- Shopping: add row stacks on narrow screens, button width is full in compact layout.
- Recipe: actions row remains readable, list scroll works, loading/empty states render.
- Events: budget/checklist cards adapt on narrow widths, footer controls visible.
- Profile: cards maintain max-width and spacing, inputs preserve consistent styles.

## Global
- Light and dark modes both readable (contrast + borders).
- Touch targets >= 40 px for primary actions.
- No clipped text on widths: 320, 375, 768, 1024, 1280.
- No horizontal page scroll on web.
