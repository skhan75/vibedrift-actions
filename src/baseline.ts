/**
 * Fetch the most recent scan for the project from the VibeDrift API.
 * Used to compute score deltas (this PR vs main branch).
 */

import * as core from "@actions/core";
import type { BaselineScan } from "./types.js";

const API_BASE = "https://vibedrift-api.fly.dev";
const TIMEOUT_MS = 10_000;

export async function fetchBaseline(
  token: string,
  projectHash: string,
): Promise<BaselineScan | null> {
  if (!projectHash) {
    core.debug("No project hash — skipping baseline fetch");
    return null;
  }

  const url = `${API_BASE}/v1/scans/latest?project_hash=${encodeURIComponent(projectHash)}`;
  core.debug(`Fetching baseline: ${url}`);

  try {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), TIMEOUT_MS);

    const res = await fetch(url, {
      headers: {
        Authorization: `Bearer ${token}`,
        "Content-Type": "application/json",
      },
      signal: controller.signal,
    });
    clearTimeout(timer);

    if (res.status === 404) {
      core.info("No previous scan found — this is the first scan for this project.");
      return null;
    }
    if (!res.ok) {
      core.warning(`Baseline fetch failed: HTTP ${res.status}`);
      return null;
    }

    const data = (await res.json()) as BaselineScan;
    core.info(`Baseline: score ${data.score} (${data.grade}) · ${data.finding_count} findings · scanned ${data.scanned_at.slice(0, 10)}`);
    return data;
  } catch (err: any) {
    core.warning(`Baseline fetch error: ${err.message ?? err}`);
    return null;
  }
}
