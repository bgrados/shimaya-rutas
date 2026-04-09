# Design System Document: Logistics & Distribution Editorial

## 1. Overview & Creative North Star: "Precision Noir"
This design system moves away from the cluttered, utility-first look of traditional logistics apps. Our Creative North Star is **Precision Noir**—a fusion of modern Japanese minimalism (Ma) and high-performance brutalism. We treat every route, package, and status update as a high-end editorial element. 

The system rejects the "standard dashboard" aesthetic in favor of intentional asymmetry, ultra-high contrast for outdoor legibility, and a sophisticated layering of dark tones. By utilizing the "Ma" concept—the celebration of empty space—we ensure that even in high-stress field environments, the interface remains calm, authoritative, and unmistakable.

---

## 2. Colors: Tonal Depth & High-Visibility Accents
We utilize a monochromatic base to ensure the `primary` red and `tertiary` cyan status indicators carry maximum psychological weight. 

### The "No-Line" Rule
**Explicit Instruction:** Designers are prohibited from using 1px solid borders to section content. Boundaries must be defined through background color shifts. For example, a `surface-container-low` card sits on a `surface` background. No lines, only depth.

### Surface Hierarchy & Nesting
Treat the UI as a series of physical layers.
- **Base Level:** `surface` (#131313)
- **Secondary Level:** `surface-container-low` (#1B1B1B) for background grouping.
- **Top Level:** `surface-container-highest` (#353535) for active cards.
- **Floating Elements:** Use Glassmorphism (Surface color at 60% opacity with a 20px backdrop blur) to allow the map or route data to bleed through subtly.

### Signature Textures
Main CTAs should not be flat. Use a subtle linear gradient transitioning from `primary` (#FFB4AC) to `primary-container` (#FF544C) at a 45-degree angle to provide a "machined" professional finish.

---

## 3. Typography: The Editorial Scale
We use a tri-font system to establish clear information hierarchy.

- **Display & Headlines (Plus Jakarta Sans):** Used for primary navigation titles and route numbers. This font provides a modern, geometric feel that anchors the page.
- **Body & Titles (Inter):** The workhorse for logistics data. High x-height ensures legibility under direct sunlight.
- **Labels (Space Grotesk):** Reserved for technical data, timestamps, and coordinates. Its monospaced leaning suggests precision and "system-level" reliability.

**The Hierarchy Rule:** Always pair a `display-sm` route number with a `label-md` timestamp to create a high-contrast visual tension that guides the eye immediately to the most critical data.

---

## 4. Elevation & Depth: Tonal Layering
Traditional shadows are too "software-standard." We use **Ambient Depth**.

- **The Layering Principle:** Stacking tiers is mandatory. A `surface-container-lowest` (#0E0E0E) element placed on a `surface-bright` (#393939) background creates a "carved out" look, perfect for input fields.
- **Ambient Shadows:** For Floating Action Buttons (FABs), use a shadow with a 24px blur, 8% opacity, tinted with the `surface-tint` (#FFB4AC) to mimic natural light reflecting off a red surface.
- **The Ghost Border Fallback:** If a container is placed on a background of the same color, use the `outline-variant` (#5B403D) at **15% opacity**. Never 100%.

---

## 5. Components

### Buttons & Field Inputs
- **Primary Action:** 100% width on mobile. High-contrast `on-primary-container` text on `primary-container` background. Minimum height of `12` (4rem) for easy gloved-hand interaction.
- **The "Field Input":** Use `surface-container-lowest` as the fill. The label should be in `label-sm` (Space Grotesk) floating above the input, never inside as placeholder text.

### Cards & Lists: The Separation Rule
**Forbid the use of divider lines.** Use the `Spacing Scale`.
- Use `spacing-4` (1.4rem) between list items.
- Use `surface-container-low` as a background for the entire list, and `surface-container-high` for the individual active item to denote selection.

### Status Indicators (High-Vis)
- **Pending/Alert:** Use `error` (#FFB4AB) with a `pulse` animation if critical.
- **Success/Complete:** Use `tertiary` (#72D4EF) rather than a generic green to maintain the "Precision Noir" palette's sophistication.

### Signature Component: The "Route Progress Monolith"
A vertical progress bar using `primary` for the completed path and `surface-container-highest` for the remaining path. The current stop is represented by a `display-md` number, creating a massive focal point for the driver.

---

## 6. Do's and Don'ts

### Do:
- **Do** use `spacing-8` and `spacing-10` to create dramatic breathing room between major sections.
- **Do** use `plusJakartaSans` for large numerical data (kilometers, time remaining).
- **Do** rely on `surface` color shifts to indicate interactive states (Hover/Press).

### Don't:
- **Don't** use 1px borders or dividers. They clutter the UI and reduce outdoor visibility.
- **Don't** use pure white (#FFFFFF) for body text; use `on-surface` (#E2E2E2) to reduce glare and eye strain for night drivers.
- **Don't** use standard "drop shadows." If it doesn't look like it's naturally floating or carved, rethink the layering.
- **Don't** use "rounded-full" for everything. Stick to `rounded-md` (0.375rem) for cards to maintain the architectural Japanese aesthetic.

---

## 7. Spacing & Rhythm
Consistency is maintained through a strictly enforced scale.
- **Container Padding:** `spacing-4` (1.4rem).
- **Component Gap:** `spacing-2` (0.7rem).
- **Section Margin:** `spacing-6` (2rem).

By adhering to these spacing tokens, the app will feel "built" rather than "assembled," providing the driver with a sense of stability and professional-grade reliability.