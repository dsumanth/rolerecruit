# Taste (Continuously Learned by [CommandCode][cmd])

[cmd]: https://commandcode.ai/

# Package Management
- Use bun instead of npm for all package management tasks. Confidence: 0.85

# Testing
- Always follow red-green TDD: write a failing test first, then minimum code to pass, then refactor. Never write implementation before tests. Confidence: 0.85

# Code Style
- Do not use mdash (—) or double dash (--) in code. Confidence: 0.85

# Git
- Never include "Co-authored-by" trailer in commit messages. Confidence: 0.85

# Development Principles
- Think Before Coding: state assumptions explicitly, surface tradeoffs, ask if unclear. Present multiple interpretations rather than picking silently. Confidence: 0.85
- Simplicity First: minimum code that solves the problem, no speculative features, no abstractions for single-use code, no unrequested flexibility. If 200 lines can be 50, rewrite. Confidence: 0.85
- Surgical Changes: touch only what's needed, don't improve adjacent code/comments/formatting, match existing style, remove only orphans your changes created. Confidence: 0.85
- Goal-Driven Execution: transform tasks into verifiable goals with defined success criteria, verify before considering work done. Confidence: 0.85
- Strictly follow Single Responsibility Principle: every module, class, and function should have exactly one reason to change. Confidence: 0.85

# Schema Migrations
- When adding new fields to existing Convex tables, always use v.optional() to avoid breaking existing production documents that lack the field. Required fields should only be added to new tables or accompanied by a migration to backfill existing documents. Confidence: 0.70

# Role-Based Access Control
- When querying permissions from a DB-backed roles table, always provide a hardcoded fallback for when roles haven't been seeded yet (e.g., empty roles table returns defaults based on the user's role name rather than an empty permission set). This prevents UI gates from hiding critical navigation before lazy seeding completes. Confidence: 0.70

# UI/UX Design
- Use Apple-esque design principles: generous whitespace, large sans-serif typography, subtle depth via shadows/blur (not harsh borders), rounded corners, minimalist color palette, smooth animations, content-first hierarchy. Avoid generic AI-generated UI patterns like random gradients, generic hero sections, and cookie-cutter dashboard layouts. Confidence: 0.85
- Pipeline stage filter pills should be single-select (radio behavior), not multi-select. Only one stage pill can be active at a time. Confidence: 0.85
- Pipeline stage pills should be dynamically sourced from the database (not hardcoded), including all stages like "rejected" and any org-specific custom stages. Confidence: 0.70
- Prefer inline content rendering over navigation indirection: show simple data directly in tabs/panels rather than requiring users to click through buttons to dedicated sub-pages. Only use navigation gateways when the content is too complex or data-heavy to load inline efficiently. Confidence: 0.70
- Design configuration UIs (automations, message templates, pipeline setup) to be usable by the least technical users: simple defaults, clear language, visual previews, guided setup flows, and minimal cognitive load. Avoid assuming technical sophistication. Confidence: 0.80
