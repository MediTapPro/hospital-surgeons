---
name: frontend-design
description: Standards and conventions for writing frontend code in the hospital-surgeons Next.js 15 + React 18 + Tailwind CSS + shadcn/ui codebase. Use this skill whenever building or restyling UI features, layout pages, components, templates, forms, handling state, or implementing translations.
---

# Frontend Design Standards — hospital-surgeons

## 1. Constants & Localization

- **Non-Localized Constants**: All internal state values, query keys, system identifiers, and configuration strings must be imported from a central constants file (e.g. `lib/utils/constants.ts`). Never hardcode them inline.
- **User-Facing Strings**: All user-facing strings must use translation helpers or standard internationalization utilities (e.g. `t()`). Text assets must reside in translation files, not inline in React components.

## 2. Styling — Tailwind CSS First, No Inline Styles

- **Tailwind Utility Classes**: Styling must rely entirely on Tailwind CSS utility classes. Always use theme variables (e.g., `bg-primary`, `text-secondary`, `gap-4`) to ensure unified styles and proper dark mode support.
- **No Inline `style={{}}`**: Avoid using inline style attributes. They bypass Tailwind's responsive prefixes, hover/focus variants, and cause unnecessary object recreation on every render. Use them only for truly dynamic run-time calculations (e.g., dynamic progress bar width).
- **Component Styling & Layout**: Use modern design principles:
  - Glassmorphism effects (e.g., `backdrop-blur-md bg-white/80`)
  - Curated, harmonious color palettes (avoid default primary red/green/blue)
  - Sleek hover micro-animations (e.g., `transition-all duration-300 hover:scale-[1.02]`)

## 3. Componentization & Structure

- **Structural JSX**: JSX code should represent the semantic structure of the page/component. Large blocks of styling or logic should be refactored into modular sub-components or custom hooks.
- **Single Responsibility**: Avoid bloated files (e.g. over 500 lines). If a component handles validation, API logic, state management, and complex layouts, split it into smaller, testable sub-components.

## 4. Comments Policy
- **No Comments by Default**: Code should be self-documenting through clear, descriptive variable and function names.
- **Allowed Comments**:
  - `// TODO:`: Single-line reminders of remaining work.
  - **WHY-not-obvious notes**: 1-2 lines explaining *why* a non-standard decision was made (e.g. a delayed state update or a workaround for a Next.js framework quirk).
- **Never Comment**:
  - What the code obviously does (e.g. `// fetch user profiles`).
  - Decorative banners (e.g. `// --- HELPERS ---`).

## 5. Accessibility (a11y) & Responsiveness
- **Semantic HTML**: Use proper semantic tags (`<main>`, `<header>`, `<nav>`, `<footer>`, `<article>`, `<aside>`).
- **Aria Labels**: Always add descriptive `aria-label` or `aria-labelledby` attributes to icon-only buttons or custom controls.
- **Responsive Layouts**: Design mobile-first using Tailwind's responsive breakpoints (`sm:`, `md:`, `lg:`, `xl:`).
- **Visible Focus**: Ensure all interactive elements have visible, high-contrast focus states (e.g. `focus-visible:ring-2`).
