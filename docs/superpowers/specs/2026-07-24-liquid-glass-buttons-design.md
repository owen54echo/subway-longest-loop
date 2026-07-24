# Liquid Glass Buttons Design

## Goal

Give every interactive HTML button in the map application a restrained iOS Liquid Glass treatment without changing markup, labels, event bindings, state management, route logic, or layout structure.

## Chosen Direction

Use the approved A direction: a low-opacity native glass material that stays subordinate to the subway map and route information. The visual model is translucent, not glossy decoration.

## Scope

Apply a shared CSS treatment to existing button families:

- Icon controls: `.btn-float`, close buttons, chip removal buttons.
- Navigation and selectors: `.nav-item`, `.city-tab`, `.tab-btn`, `.speed-btn`, station-menu controls, analysis selectors.
- Commands: `.btn-primary`, `.btn-cancel-solver`, `.map-popup-btn`, `.analysis-action`, `.cruise-btn`.
- Modal and exploration controls that are native `button` elements.

Do not alter inputs, SVG station controls, map lines, panels, drawers, route cards, or application behavior.

## Material Tokens

Add centralized tokens in `styles.css` for each theme:

- Low-opacity neutral surface and a stronger command surface.
- One light top highlight and one low-contrast edge.
- Soft elevated shadow appropriate to light and dark themes.
- Shared 18px blur with saturation; keep a plain background fallback when browser support is absent.
- A readable disabled surface with reduced opacity but unchanged layout.

## States and Motion

- Default: translucent glass, rounded 10-14px corners, inner highlight, gentle elevation.
- Hover-capable devices: `scale(1.02)`, modest brightness increase, slightly stronger edge and reflection.
- Active: `scale(0.96)` with reduced shadow.
- Focus-visible: existing keyboard focus remains clear and exceeds the visual border contrast.
- Active/selected states retain their current semantic colors through translucent tint, rather than opaque replacement.
- Disabled/loading states do not scale and remain visually distinct.
- `prefers-reduced-motion: reduce` removes transform motion while preserving all states.

## Responsive and Accessibility Constraints

- No button size reduction; existing mobile touch targets remain intact.
- City tabs keep horizontal scrolling and do not receive transform behavior that shifts the strip.
- Icon buttons retain fixed square dimensions and become circular only where their existing visual role is already icon-only.
- Button text retains existing contrast and font sizing.
- No new JavaScript, dependencies, or UI framework.

## Verification

- Static contract test verifies the centralized Liquid Glass tokens, hover/active values, reduced-motion rule, and selector coverage.
- Run existing map-style contracts and the 9-case route regression suite.
- Inspect light and dark themes in desktop and `390 x 844` mobile viewports, including primary, disabled, active tab, popup, cruise, and close controls.

## Non-Goals

- Replacing the map's cartographic style.
- Changing any button wording, HTML structure, event handler, route calculation, or persisted preference.
- Adding global gradients, a new component library, or a theme switcher.
