# Accessibility

Accessibility is a headline feature of this library, not a polish item.

<important if="you are building UI, modifying templates or keyboard handling, or doing accessibility review">

- Everything MUST pass all axe checks, and the demo's Lighthouse accessibility score must stay at **100** (navigation mode for the page, snapshot mode for an open overlay).
- Everything MUST meet WCAG 2.2 AA: contrast (4.5:1 text, 3:1 UI), focus visible, focus order, target size ≥ 24px, no keyboard traps outside the modal overlay.
- Overlay panel: `role="dialog"`, `aria-modal="true"`, an accessible name (`ariaLabel` input), focus trapped with `cdkTrapFocus`, closed by Escape, focus restored to the trigger (`restoreFocus`).
- Time fields: `role="spinbutton"` with `aria-valuenow` / `aria-valuemin` / `aria-valuemax` / `aria-valuetext`. Keyboard: ArrowUp/Down (step), PageUp/PageDown (×5), Home/End (bounds), type-to-set. Value changes are announced through CDK `LiveAnnouncer`, only when the value actually changes.
- Inputs: open with Alt+ArrowDown. Range containers are `role="group"` with a label; each part input has its own `aria-label`.
- Toggle buttons that represent state (AM/PM) use `aria-pressed`. Icon-only buttons need an `aria-label`.
- Screen-reader-only text needs a component-local visually-hidden class, because `.cdk-visually-hidden` is only available when the consumer includes CDK a11y styles.
- Any new interaction gets a keyboard-only test path in specs, and a manual check in the demo with chrome-devtools before the task is complete.
  </important>
