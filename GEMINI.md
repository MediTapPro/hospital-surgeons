# Antigravity Workspace Rules — hospital-surgeons

This file defines the workspace rules and skills for the **hospital-surgeons** project. Antigravity must always read and adhere to these guidelines for all tasks.

## 1. Load Local Skills First
Before performing any development, refactoring, or review, Antigravity must proactively read the relevant skill files in the `.agents/skills/` directory:
- [database/SKILL.md](file:///home/trans-rental001/Downloads/Personal/hospital-surgeons/.agents/skills/database/SKILL.md) (Drizzle schema, transaction boundaries, CTE approach)
- [patient-registration/SKILL.md](file:///home/trans-rental001/Downloads/Personal/hospital-surgeons/.agents/skills/patient-registration/SKILL.md) (Signup validation, password hashing, user-profile linking)
- [frontend-design/SKILL.md](file:///home/trans-rental001/Downloads/Personal/hospital-surgeons/.agents/skills/frontend-design/SKILL.md) (Next.js 15, Tailwind, accessibility, component layout)
- [branches-and-commits/SKILL.md](file:///home/trans-rental001/Downloads/Personal/hospital-surgeons/.agents/skills/branches-and-commits/SKILL.md) (Git conventions, branch naming, issue-linked commit messages)

## 2. Core Architectural Standards
- **Repository vs Service Separation**: Repositories in `/lib/repositories/` only contain queries. Services in `/lib/services/` contain business logic.
- **Transactions**: Wrap multi-write operations in database transactions.
- **SQL CTE Approach**: For complex multi-stage updates or reads, favor SQL Common Table Expressions to execute logic atomically and efficiently.
- **Aesthetics & UI**: Use rich aesthetics, modern typography, glassmorphism, responsive Tailwind design, and micro-animations. No inline styles.
