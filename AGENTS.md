# Equity Intelligence — Agent Guidelines (Elephant-Goldfish Model & Engineering Standards)

This repository operates under Google's Elephant-Goldfish Model (EGM), the Apple Liquid Glass design system, and strict quantitative financial engineering standards.

## 1. Elephant-Goldfish Model (EGM) Protocol

- **Elephant (Root Agent Context)**: Holds the accumulated context of the Indian equities intelligence platform, financial statement schemas (Standalone vs Consolidated), corporate action history, valuation formulas, and phased milestones.
- **Goldfish (Stateless Audit & Review)**:
  - Before landing substantial architectural changes or new phases (e.g., Phase 14 Portfolio Analytics), audit the specification and mathematical algorithms without relying on conversational shorthand.
  - Stress-test financial algorithms: zero-division in percentage calculations, Newton-Raphson convergence failures in XIRR, FIFO lot matching edge cases, and rounding precision for Indian Rupee (INR) transactions.
- **Behavioral Principles**:
  - **No Glazing**: Zero empty praise or sycophancy. Lead directly with architectural risks, numerical edge cases, and security vulnerabilities.
  - **No Polite Apologies**: Do not waste turns on apologies. State the corrected logic, root cause, and remediation plan directly.
  - **Artifact-First**: Save design specifications, phase milestones, and architectural plans in artifacts or `docs/designs/`.

## 2. Frontend Engineering (Apple Liquid Glass & Web Standards)

- **Design System**: Strictly adhere to Apple Liquid Glass:
  - Neutral canvas: `--bg-base: #f5f5f7`, panels: `--surface: #ffffff`.
  - Hairline dividers: `rgba(0, 0, 0, 0.07)`.
  - Accent hierarchy: Apple Blue (`#0071e3`), Green (`#28cd41` up), Red (`#ff3b30` down).
  - Typography: SF Pro system stack with negative tracking on headings and `tabular-nums` on all financial tables and price tickers.
  - Glass overlays: Frosted navigation bars and sidebars with `backdrop-filter: saturate(180%) blur(20px)`.
- **Performance & A11y**:
  - Eliminate request waterfalls via `Promise.allSettled` or parallel fetching.
  - Maintain full WCAG AA compliance (explicit `aria-label`, `<label htmlFor>`, keyboard navigation).

## 3. Backend & Quantitative Standards

- **Python & FastAPI**: Use strict typing, Pydantic schemas, dependency injection, and async database sessions.
- **Financial Calculations**: Pure deterministic calculation modules in `app/calculations/` decoupled from database ORM models.
- **Testing Gate**: No phase is considered complete without green test suites (`pytest` for backend, `vitest` and `tsc --noEmit` for frontend).
