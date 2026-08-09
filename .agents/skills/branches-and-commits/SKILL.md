---
name: branches-and-commits
description: Version control standards for hospital-surgeons — branch naming conventions, commit messages, and pull request rules. Use this skill whenever creating git branches, writing commit messages, or structuring pull requests.
---

# Branches & Commit Message Standards

## 1. Branch Naming Convention
Always prefix branch names with the type of work and include the ticket/issue number:
- Format: `<type>/<issue-number>-<short-kebab-description>`
- Examples:
  - `feature/102-patient-signup`
  - `fix/114-jwt-token-expiration`
  - `chore/85-update-dependencies`

## 2. Commit Messages
- Use the imperative mood in the commit subject.
- Always include the issue number in the commit message:
  - Format: `<action>(<scope>): <description> #<issue-number>`
  - Examples:
    - `feat(auth): implement patient signup flow #102`
    - `fix(db): add patient role to users constraint #85`

## 3. Pull Request Guidelines
- Keep PRs focused on a single sub-task or story.
- Always link the parent issue in the PR description using `Closes #<issue-number>`.
