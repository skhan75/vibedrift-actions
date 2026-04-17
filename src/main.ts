/**
 * VibeDrift GitHub Action — entry point.
 *
 * Flow:
 *   1. Read inputs
 *   2. Run VibeDrift CLI (scan + parse JSON)
 *   3. Fetch baseline (previous scan for this project)
 *   4. Compute delta (score change, new drifts)
 *   5. Post/update PR comment
 *   6. Set outputs + fail if below threshold
 */

import * as core from "@actions/core";
import * as github from "@actions/github";
import { runScan } from "./scan.js";
import { fetchBaseline } from "./baseline.js";
import { computeDelta, currentGrade } from "./delta.js";
import { buildCommentBody, postOrUpdateComment } from "./comment.js";
import type { ActionInputs } from "./types.js";

function readInputs(): ActionInputs {
  const failOnScoreStr = core.getInput("fail-on-score");
  return {
    token: core.getInput("token", { required: true }),
    path: core.getInput("path") || ".",
    failOnScore: failOnScoreStr ? parseFloat(failOnScoreStr) : null,
    deep: core.getInput("deep") === "true",
    comment: core.getInput("comment") !== "false",
    commentOnPass: core.getInput("comment-on-pass") !== "false",
  };
}

async function run(): Promise<void> {
  try {
    const inputs = readInputs();
    core.info(`VibeDrift Action — scanning ${inputs.path}${inputs.deep ? " (deep)" : ""}`);

    // Step 1: Run the scan
    const { result, projectHash, scanId } = await runScan(
      inputs.path,
      inputs.token,
      inputs.deep,
    );

    const score = result.compositeScore;
    const grade = currentGrade(result);

    // Step 2: Fetch baseline for delta
    const baseline = await fetchBaseline(inputs.token, projectHash);

    // Step 3: Compute delta
    const delta = computeDelta(result, baseline);

    // Step 4: Set outputs
    core.setOutput("score", String(score));
    core.setOutput("grade", grade);
    core.setOutput("finding-count", String(result.findings.length));
    core.setOutput("delta", delta ? String(delta.score) : "");
    core.setOutput("report-url", scanId ? `https://vibedrift.ai/dashboard/scans/${scanId}` : "");

    // Step 5: Post PR comment
    const isPR = !!github.context.payload.pull_request;
    const belowThreshold = inputs.failOnScore !== null && score < inputs.failOnScore;

    if (inputs.comment && isPR) {
      if (inputs.commentOnPass || belowThreshold || (delta && delta.newDrifts.length > 0)) {
        const ghToken = process.env.GITHUB_TOKEN ?? "";
        if (ghToken) {
          const body = buildCommentBody(result, baseline, delta, scanId);
          await postOrUpdateComment(ghToken, body);
        } else {
          core.warning("GITHUB_TOKEN not available — cannot post PR comment. Add `permissions: pull-requests: write` to your workflow.");
        }
      }
    }

    // Step 6: Summary (always — visible in Actions tab even without PR comment)
    const summary = [
      `## VibeDrift Scan`,
      `**Score:** ${score}/${result.maxCompositeScore} (${grade})`,
      `**Findings:** ${result.findings.length}`,
      delta ? `**Delta:** ${delta.score > 0 ? "+" : ""}${delta.score} pts (${delta.direction})` : "_First scan — no baseline_",
      "",
      `Scan time: ${(result.scanTimeMs / 1000).toFixed(1)}s · ${result.context.files.length} files · ${result.context.totalLines.toLocaleString()} lines`,
    ];
    if (scanId) {
      summary.push(`\n[View full report →](https://vibedrift.ai/dashboard/scans/${scanId})`);
    }
    await core.summary.addRaw(summary.join("\n")).write();

    // Step 7: Fail if below threshold
    if (belowThreshold) {
      core.setFailed(
        `VibeDrift: score ${score} is below threshold ${inputs.failOnScore}. ` +
          `Fix the top drifts and re-push.`,
      );
    }
  } catch (err: any) {
    core.setFailed(`VibeDrift Action failed: ${err.message ?? err}`);
  }
}

run();
