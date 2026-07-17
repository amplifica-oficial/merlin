---
name: create-issue
description: Create a GitHub issue on the project repo via gh CLI, written in English. Use when the user asks to open an issue, create an issue, report a bug, or file a feature request. Requires user confirmation before running gh issue create.
---

# Create Issue

Draft and open a GitHub issue on `amplifica-oficial/merlin` using the `gh` CLI.

**Autonomy boundary:** draft the issue, present it to the user, wait for confirmation, then create. Never create an issue without explicit user approval.

**Language:** the issue title and body are always written in **English** (international standard), regardless of the language the user speaks to you in.

## Repo conventions

| Item | Value |
|------|-------|
| Target repo | `amplifica-oficial/merlin` (ALWAYS via `--repo`) |
| Upstream | `useplunk/plunk` (NEVER an issue target without explicit user request) |
| CLI | `gh` (GitHub CLI) |

## Sandbox / permissions (required)

GitHub CLI auth **does not work inside the Cursor sandbox**. Every `gh` invocation **must** run unrestricted:

```
required_permissions: ["all"]
```

Applies to: `gh auth status`, `gh repo view`, `gh issue create`, `gh issue view`, `gh label list`.

Do **not** run these in the default sandbox or with only `full_network` — credential helper / keychain access fails. If a `gh` call fails with auth errors after running sandboxed, re-run the **exact same command** with `["all"]`.

## Workflow

Copy this checklist and track progress:

```
Task Progress:
- [ ] Step 1: Verify gh authentication and target repo
- [ ] Step 2: Gather issue details
- [ ] Step 3: Draft issue title and body (English)
- [ ] Step 4: Present draft and wait for confirmation
- [ ] Step 5: Create issue via gh
```

### Step 1: Verify gh authentication and target repo

Run **outside the sandbox** (`required_permissions: ["all"]`):

```bash
gh auth status
gh repo view --json nameWithOwner -q .nameWithOwner
```

If token is invalid or not logged in:

1. Stop immediately — do not attempt `gh issue create`.
2. Tell the user to run: `gh auth login -h github.com`
3. Resume only after auth succeeds.

If the resolved repo is not `amplifica-oficial/merlin`, always pass `--repo amplifica-oficial/merlin` explicitly (Step 5 does this). Never file an issue on `useplunk/plunk` or any `*-fork` repo unless the user explicitly requests it.

### Step 2: Gather issue details

Determine from the conversation (ask only if missing):

- **Type**: bug report, feature request, task, or question
- **Title**: short, imperative, specific
- **Context**: what, why, affected apps/packages (`web`, `api`, `@merlin/db`, etc.)
- **Repro / expected behavior** (for bugs)
- **Labels** (optional). List available labels if unsure:

```bash
gh label list --repo amplifica-oficial/merlin
```

### Step 3: Draft issue title and body (English)

**Title:** concise and specific. Optionally prefix with a type, e.g. `[Bug]`, `[Feature]`.

**Body template — Bug:**

```markdown
## Description
Clear summary of the problem.

## Steps to reproduce
1. ...
2. ...

## Expected behavior
What should happen.

## Actual behavior
What actually happens.

## Affected area
app/package, environment, version.
```

**Body template — Feature / task:**

```markdown
## Summary
What should be built and why.

## Proposed solution
Outline of the approach (optional).

## Affected area
app/package.

## Acceptance criteria
- [ ] ...
- [ ] ...
```

**Body rules:**

- English only
- Bullets over long paragraphs
- Do not include internal agent reasoning or raw tool output

### Step 4: Present draft and wait for confirmation

Show the user:

```markdown
## Issue Draft

**Repo:** amplifica-oficial/merlin
**Title:** [Bug] short summary
**Labels:** bug (if any)

**Body:**
[paste full body here]

---
Reply to confirm, or tell me what to change.
```

**STOP here.** Do not run `gh issue create` until the user confirms.

If the user requests edits, update the draft and present again.

### Step 5: Create issue via gh

After user confirmation, run **outside the sandbox** (`required_permissions: ["all"]`):

```bash
gh issue create \
  --repo amplifica-oficial/merlin \
  --title "[Bug] short summary" \
  --body "$(cat <<'EOF'
## Description
...

## Steps to reproduce
1. ...
EOF
)"
```

Add `--label "bug"` (repeatable) only for labels confirmed to exist. Omit labels rather than guessing.

**Always pass `--repo amplifica-oficial/merlin` explicitly.** Never rely on the implicit `gh` default repo.

After creation, validate the returned URL contains `github.com/amplifica-oficial/merlin/issues/`. If it points to `useplunk/plunk` or any other repo, report failure immediately — do not treat it as success.

## Git safety rules

**Never:**

- Run `gh` inside the Cursor sandbox (auth breaks)
- `gh issue create` without `--repo amplifica-oficial/merlin`
- File an issue against `useplunk/plunk` or any `*-fork` repo without explicit user request
- Write the issue in a language other than English
- Add labels that were not confirmed to exist
- Create an issue without user confirmation
- Modify `git config`

## Output format

After creating:

```markdown
## Issue created

**URL:** https://github.com/amplifica-oficial/merlin/issues/NNN
**Title:** [Bug] short summary
**Labels:** bug
```

If blocked (auth failure, wrong repo), explain the blocker and next step.
