# VibeDrift GitHub Action

**Catch drift before merge.** Run [VibeDrift](https://vibedrift.ai) on every PR to detect architectural contradictions, hidden duplicates, security gaps, and convention drift in AI-generated code.

## What it does

- Runs VibeDrift on every pull request
- Posts a PR comment with the score delta + new drifts introduced
- Optionally fails the check if the score drops below your threshold
- Links to the full interactive report on vibedrift.ai

TEST
## Quick setup

```yaml
# .github/workflows/vibedrift.yml
name: VibeDrift
on: [pull_request]

permissions:
  pull-requests: write

jobs:
  drift-check:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: vibedrift/vibedrift-actions@v1
        with:
          token: ${{ secrets.VIBEDRIFT_TOKEN }}
          fail-on-score: 70
        env:
          GITHUB_TOKEN: ${{ secrets.GITHUB_TOKEN }}
```

### Getting your token

1. Sign up at [vibedrift.ai](https://vibedrift.ai/login) (free, no card)
2. Go to Dashboard → Settings → API Token
3. Add the token as a GitHub Secret: Settings → Secrets → `VIBEDRIFT_TOKEN`

## PR comment

On every PR, the Action posts a comment like:

```
## VibeDrift — Drift Report

| Metric | Baseline | This PR | Delta |
|---|---|---|---|
| Score | 81/100 (B) | 78/100 (B) | 🔴 -3 ↓ |
| Findings | 165 | 172 | +7 |

### New drift in this PR

- handlers/newHandler.ts uses raw SQL while 7 peers use repository
  → New code in this directory will copy the wrong pattern
- Missing auth middleware on /api/v2/reports
  → Unprotected routes may be exposed in production
```

The comment updates on each push (no spam).

## Inputs

| Input | Required | Default | Description |
|---|---|---|---|
| `token` | Yes | — | VibeDrift API token |
| `path` | No | `.` | Path to scan |
| `fail-on-score` | No | — | Fail if score < threshold |
| `deep` | No | `false` | Run AI deep scan (uses scan budget) |
| `comment` | No | `true` | Post PR comment |
| `comment-on-pass` | No | `true` | Comment even when passing |

## Outputs

| Output | Description |
|---|---|
| `score` | Composite score (0-100) |
| `grade` | Letter grade (A-F) |
| `finding-count` | Total findings |
| `delta` | Score change vs baseline |
| `report-url` | Dashboard URL |

## Examples

### Fail on score drop

```yaml
- uses: vibedrift/vibedrift-actions@v1
  with:
    token: ${{ secrets.VIBEDRIFT_TOKEN }}
    fail-on-score: 70
```

### Deep scan on release branches

```yaml
- uses: vibedrift/vibedrift-actions@v1
  with:
    token: ${{ secrets.VIBEDRIFT_TOKEN }}
    deep: ${{ github.base_ref == 'main' }}
```

### Scan a subdirectory (monorepo)

```yaml
- uses: vibedrift/vibedrift-actions@v1
  with:
    token: ${{ secrets.VIBEDRIFT_TOKEN }}
    path: packages/api
```

### Use outputs in subsequent steps

```yaml
- uses: vibedrift/vibedrift-actions@v1
  id: drift
  with:
    token: ${{ secrets.VIBEDRIFT_TOKEN }}
- run: echo "Score is ${{ steps.drift.outputs.score }}"
```

## Pricing

Free scans (no `--deep`) are **unlimited** and don't consume scan budget. Deep scans use your monthly allowance:

| Plan | Deep scans/month | Price |
|---|---|---|
| Free | 3 | $0 |
| Pro | 50 | $15/mo |
| Scale | 100 | $30/mo |

Most CI setups should use free scans by default. Add `deep: true` only for release branches or critical PRs.

## Privacy

The Action runs `npx @vibedrift/cli` inside your GitHub runner. Source code stays on the runner — nothing is uploaded. Only function snippets (max 60 lines each) are sent when `deep: true` is set. [Privacy policy →](https://vibedrift.ai/privacy)

## Links

- [vibedrift.ai](https://vibedrift.ai) — Website + dashboard
- [npm](https://www.npmjs.com/package/@vibedrift/cli) — CLI package
- [Releases](https://vibedrift.ai/releases) — Changelog
- [Setup guide](https://vibedrift.ai/guide) — Full documentation
