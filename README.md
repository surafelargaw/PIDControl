# PID Control Platform

An interactive teaching tool for PID tuning, HVAC/BAS simulation, and vendor controller comparison. Built with Vite, React 19, and TypeScript. All simulation and data storage runs entirely in the browser - no backend or environment variables are required.

## Features

| Module | Description |
|--------|-------------|
| **Lab** | Generic PID simulator with 10+ process models, real-time trend chart, and tuning method studies (Ziegler-Nichols, Cohen-Coon, IMC/Lambda, Relay Autotune) |
| **HVAC Simulator** | Multi-loop cascade control for direct-evap, air-cooled, and liquid-cooled plants with psychrometric calculations and scenario progression |
| **Import Data** | CSV/XLSX trend import for historical controller SP/PV/CO analysis, stability verdicts, and optional PID metadata review |
| **Vendor PID Lab** | Side-by-side comparison of Siemens, Honeywell, ALC, JCI, and ABB PID controller algorithms |
| **Stability Lab** | Three-panel root-locus / pole-placement visualizer showing stable, marginal, and unstable responses |
| **Learn** | 33 indexed lessons covering PID fundamentals, tuning methods, troubleshooting, advanced topics, and platform guides; full-text search included |
| **Scenarios** | Structured exercises with pass/fail scoring based on overshoot, settling time, and actuator activity |
| **Saved Runs** | Browser-local run history with CSV and PDF export |
| **Instructor** | Local session overview with attempt counts and pass rates |

## Architecture

- **Pure client-side** - Vite single-page app with hash routing; no API routes or server actions.
- **No backend** - all saved runs, scenario attempts, and preferences are stored in `localStorage` (capped at 50 runs / 200 attempts).
- **No environment variables** - clone and run, nothing to configure.
- **Offline support** - a service worker caches static assets for offline use.

## Getting Started

```bash
npm install
npm run dev        # starts the Vite dev server
```

## Common Commands

```bash
npm run dev        # local dev server
npm run build      # type-check and create dist/
npm run preview    # serve the production build locally
npm run lint       # TypeScript check
npm run test       # run simulator and content tests
```

## Content

Lesson markdown files live in `public/legacy/docs/sections/` and related images in `public/legacy/help/`. To add a lesson, drop a `.md` file in that folder and register it in [src/lib/content/lessons.ts](src/lib/content/lessons.ts).

## Tests

```bash
npm run test
```

Seven test files cover the HVAC runtime, generic simulator engine, tuning algorithms, vendor PID profiles, stability analysis, lesson content loading, and chart rendering.
