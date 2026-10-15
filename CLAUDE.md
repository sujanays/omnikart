# Shop Sarathi

Voice-first interface to assist visually impaired people in shopping.

## gstack

Use the `/browse` skill from gstack for all web browsing. Never use `mcp__claude-in-chrome__*` tools.

gstack is installed globally at `~/.claude/skills/gstack`. Available skills:

### Plan

- `/office-hours` — pressure-test an idea before building (YC office hours style)
- `/spec` — turn vague intent into a precise, executable spec
- `/autoplan` — run the CEO, design, eng and DX plan reviews in sequence with auto-decisions
- `/plan-ceo-review` — CEO/founder-mode plan review
- `/plan-eng-review` — eng manager-mode plan review
- `/plan-design-review` — designer's eye plan review
- `/plan-devex-review` — developer experience plan review
- `/plan-tune` — tune how often gstack asks questions

### Design

- `/design-consultation` — propose a complete design system for the product
- `/design-shotgun` — generate several design variants and compare them
- `/design-html` — turn a chosen design into production-quality HTML/CSS
- `/design-review` — find and fix visual inconsistency, spacing and hierarchy problems
- `/diagram` — turn a description or mermaid source into an editable diagram, SVG and PNG

### Review and test

- `/review` — pre-landing review of the current diff or PR
- `/codex` — second opinion from the OpenAI Codex CLI (needs Codex installed)
- `/cso` — security audit
- `/qa` — test the running app and fix the bugs found
- `/qa-only` — test the running app and report bugs without fixing
- `/investigate` — systematic debugging with root cause investigation
- `/health` — code quality dashboard
- `/test-audit` — find low-value or duplicate tests
- `/deslop-shared-libs` — find worthwhile shared-code extractions in recent work
- `/devex-review` — live developer experience audit
- `/benchmark` — performance regression detection
- `/benchmark-models` — compare gstack skills across models

### Ship and deploy

- `/ship` — merge base, run tests, review, bump version, commit, push, open a PR
- `/land-and-deploy` — land the PR and deploy
- `/landing-report` — read-only dashboard of the ship queue
- `/setup-deploy` — configure deployment settings for `/land-and-deploy`
- `/canary` — post-deploy canary monitoring
- `/document-release` — audit docs against what shipped
- `/document-generate` — generate missing documentation from scratch
- `/retro` — weekly engineering retrospective

### Browser

- `/browse` — open pages, click through flows, take screenshots, check console errors
- `/scrape` — pull data from a web page
- `/skillify` — save the last successful `/scrape` flow as a reusable browser skill
- `/connect-chrome` — launch the GStack Browser (AI-controlled Chromium with sidebar)
- `/open-gstack-browser` — same as `/connect-chrome`
- `/setup-browser-cookies` — import cookies from your real browser into the browse session
- `/pair-agent` — pair a remote AI agent with your browser
- `/make-pdf` — turn a markdown file into a publication-quality PDF

### Safety

- `/careful` — warn before destructive commands
- `/freeze` — restrict file edits to one directory for the session
- `/unfreeze` — clear the `/freeze` boundary
- `/guard` — `/careful` and `/freeze` together

### Context and memory

- `/context-save` — save working context
- `/context-restore` — restore context saved by `/context-save`
- `/learn` — manage project learnings
- `/setup-gbrain` — set up the gbrain memory CLI for this agent
- `/sync-gbrain` — keep gbrain current with this repo's code

### iOS (only if an iOS app is added)

- `/ios-qa` — live-device QA for SwiftUI apps
- `/ios-fix` — autonomous iOS bug fixer
- `/ios-design-review` — visual design audit on real hardware
- `/ios-sync` — regenerate the iOS debug bridge from upstream templates
- `/ios-clean` — remove the debug bridge from an iOS app

### Maintenance

- `/gstack` — router for the gstack skill suite
- `/gstack-upgrade` — upgrade gstack to the latest version
