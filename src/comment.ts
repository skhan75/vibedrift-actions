/**
 * Build the PR comment markdown and post/update it via GitHub API.
 *
 * Uses a hidden marker (<!-- vibedrift-pr-comment -->) to find and
 * update existing comments instead of spamming new ones on force-pushes.
 */

import * as github from "@actions/github";
import * as core from "@actions/core";
import type { ScanResult, BaselineScan, Delta, Finding } from "./types.js";
import { currentGrade } from "./delta.js";

const COMMENT_MARKER = "<!-- vibedrift-pr-comment -->";
const DASHBOARD_BASE = "https://vibedrift.ai/dashboard";

function consequenceLine(f: Finding): string {
  const id = f.analyzerId;
  const tags = f.tags ?? [];
  if (tags.includes("security_posture") || id.startsWith("drift-security") || id === "security")
    return "Unprotected routes may be exposed in production";
  if (tags.includes("architectural_consistency") || id.startsWith("drift-architectural") || id === "codedna-pattern")
    return "New code in this directory will copy the wrong pattern";
  if (tags.includes("semantic_duplication") || id === "codedna-fingerprint" || id === "duplicates")
    return "Duplicate logic will diverge silently over time";
  if (id === "dependencies")
    return "Missing deps will break the build for other developers";
  if (f.metadata?.intentDivergence)
    return "Code contradicts the team's declared convention";
  return "Inconsistency detected across files";
}

export function buildCommentBody(
  result: ScanResult,
  baseline: BaselineScan | null,
  delta: Delta | null,
  scanId: string | null,
): string {
  const score = result.compositeScore;
  const max = result.maxCompositeScore;
  const grade = currentGrade(result);
  const findings = result.findings.length;

  const lines: string[] = [COMMENT_MARKER];
  lines.push("## VibeDrift — Drift Report");
  lines.push("");

  // Score table
  if (baseline && delta) {
    const arrow = delta.score > 0 ? "↑" : delta.score < 0 ? "↓" : "→";
    const deltaColor = delta.score > 0 ? "🟢" : delta.score < -2 ? "🔴" : "🟡";
    lines.push("| Metric | Baseline | This PR | Delta |");
    lines.push("|---|---|---|---|");
    lines.push(`| Score | ${baseline.score}/${max} (${baseline.grade}) | **${score}/${max} (${grade})** | ${deltaColor} ${delta.score > 0 ? "+" : ""}${delta.score} ${arrow} |`);
    lines.push(`| Findings | ${baseline.finding_count} | ${findings} | ${delta.findings > 0 ? "+" : ""}${delta.findings} |`);
  } else {
    lines.push(`**Score:** ${score}/${max} (**${grade}**) · ${findings} findings`);
    lines.push("");
    lines.push("_First scan for this project — no baseline to compare against._");
  }
  lines.push("");

  // New drifts
  if (delta && delta.newDrifts.length > 0) {
    lines.push("### New drift in this PR");
    lines.push("");
    for (const f of delta.newDrifts.slice(0, 5)) {
      const msg = f.message.replace(/^DRIFT:\s*/, "").slice(0, 120);
      const loc = f.locations[0];
      const where = loc ? `\`${loc.file}${loc.line ? `:${loc.line}` : ""}\`` : "";
      lines.push(`- ${msg}`);
      if (where) lines.push(`  ${where} → _${consequenceLine(f)}_`);
    }
    if (delta.newDrifts.length > 5) {
      lines.push(`- _…and ${delta.newDrifts.length - 5} more_`);
    }
    lines.push("");
  }

  // Category breakdown (compact)
  const scores = (result as any).scores;
  if (scores && typeof scores === "object") {
    lines.push("<details>");
    lines.push("<summary>Category breakdown</summary>");
    lines.push("");
    lines.push("| Category | Score |");
    lines.push("|---|---|");
    for (const [key, val] of Object.entries(scores)) {
      const v = val as any;
      if (v && typeof v.score === "number" && v.applicable !== false) {
        lines.push(`| ${key} | ${v.score}/${v.maxScore} |`);
      }
    }
    lines.push("");
    lines.push("</details>");
    lines.push("");
  }

  // CTA
  if (scanId) {
    lines.push(`[View full report →](${DASHBOARD_BASE}/scans/${scanId})`);
  }
  lines.push("");
  lines.push("---");
  lines.push(`_VibeDrift · [vibedrift.ai](https://vibedrift.ai) · Run locally: \`npx @vibedrift/cli .\`_`);

  return lines.join("\n");
}

export async function postOrUpdateComment(
  token: string,
  body: string,
): Promise<void> {
  const context = github.context;
  if (!context.payload.pull_request) {
    core.info("Not a pull_request event — skipping comment.");
    return;
  }

  const octokit = github.getOctokit(token);
  const { owner, repo } = context.repo;
  const prNumber = context.payload.pull_request.number;

  // Find existing VibeDrift comment
  const { data: comments } = await octokit.rest.issues.listComments({
    owner,
    repo,
    issue_number: prNumber,
    per_page: 100,
  });
  const existing = comments.find((c) => c.body?.includes(COMMENT_MARKER));

  if (existing) {
    await octokit.rest.issues.updateComment({
      owner,
      repo,
      comment_id: existing.id,
      body,
    });
    core.info(`Updated existing PR comment #${existing.id}`);
  } else {
    await octokit.rest.issues.createComment({
      owner,
      repo,
      issue_number: prNumber,
      body,
    });
    core.info("Posted new PR comment");
  }
}
