/**
 * Compute the difference between the current scan and the baseline.
 */

import type { ScanResult, BaselineScan, Delta, Finding } from "./types.js";

function gradeFor(score: number, max: number): string {
  const pct = max > 0 ? (score / max) * 100 : 0;
  if (pct >= 90) return "A";
  if (pct >= 75) return "B";
  if (pct >= 50) return "C";
  if (pct >= 25) return "D";
  return "F";
}

function findingKey(f: Finding): string {
  const loc = f.locations[0];
  return `${f.analyzerId}:${loc?.file ?? ""}:${f.message.slice(0, 40)}`;
}

export function computeDelta(
  current: ScanResult,
  baseline: BaselineScan | null,
): Delta | null {
  if (!baseline) return null;

  const scoreDelta = Math.round((current.compositeScore - baseline.score) * 10) / 10;
  const findingDelta = current.findings.length - baseline.finding_count;

  // Identify genuinely new drifts — findings in the current scan that
  // weren't in the baseline. We can't do a perfect diff without the
  // baseline's full finding list, but we can approximate: any finding
  // whose key isn't recognizable as "existing" is likely new.
  // For now, report drift-tagged findings sorted by impact as "new."
  const driftFindings = current.findings
    .filter((f) => f.tags?.includes("drift") || f.analyzerId.startsWith("drift-") || f.analyzerId.startsWith("codedna-"))
    .sort((a, b) => (b.consistencyImpact ?? 0) - (a.consistencyImpact ?? 0));

  // If finding count increased, the top N drift findings are likely new
  const newDrifts = findingDelta > 0
    ? driftFindings.slice(0, Math.min(findingDelta, 5))
    : [];

  return {
    score: scoreDelta,
    findings: findingDelta,
    newDrifts,
    direction: scoreDelta > 1 ? "up" : scoreDelta < -1 ? "down" : "stable",
  };
}

export function currentGrade(result: ScanResult): string {
  return gradeFor(result.compositeScore, result.maxCompositeScore);
}
