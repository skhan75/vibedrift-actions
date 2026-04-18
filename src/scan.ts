/**
 * Run VibeDrift CLI and parse the JSON output.
 */

import * as exec from "@actions/exec";
import * as core from "@actions/core";
import type { ScanResult } from "./types.js";

export async function runScan(
  path: string,
  token: string,
  deep: boolean,
): Promise<{ result: ScanResult; projectHash: string; scanId: string | null }> {
  let stdout = "";
  let stderr = "";

  const args = ["-y", "@vibedrift/cli", path, "--json", "--no-cache"];
  if (deep) args.push("--deep");

  const exitCode = await exec.exec("npx", args, {
    env: {
      ...process.env,
      VIBEDRIFT_TOKEN: token,
    },
    silent: true,
    listeners: {
      stdout: (data: Buffer) => {
        stdout += data.toString();
      },
      stderr: (data: Buffer) => {
        stderr += data.toString();
      },
    },
    ignoreReturnCode: true,
  });

  // Log stderr for debugging (scan timing, verbose output)
  if (stderr.trim()) {
    core.debug(`CLI stderr:\n${stderr}`);
  }

  // Parse JSON from stdout
  let result: ScanResult;
  try {
    result = JSON.parse(stdout);
  } catch (err) {
    core.error(`Failed to parse CLI JSON output. Exit code: ${exitCode}`);
    core.debug(`stdout (first 500 chars): ${stdout.slice(0, 500)}`);
    throw new Error("VibeDrift CLI did not produce valid JSON. Ensure @vibedrift/cli is installed and the path is correct.");
  }

  // Extract project hash from the scan result — the CLI embeds it
  // in result_json.project.hash when logged in.
  const project = (result as any).project ?? {};
  const projectHash: string = project.hash ?? "";

  // Extract scan ID if available (set by the scan-log upload)
  const scanId: string | null = (result as any).__scanId ?? null;

  // Compute grade from score
  const pct = result.maxCompositeScore > 0
    ? (result.compositeScore / result.maxCompositeScore) * 100
    : 0;

  core.info(`Score: ${result.compositeScore}/${result.maxCompositeScore} | Findings: ${result.findings.length} | Time: ${(result.scanTimeMs / 1000).toFixed(1)}s`);

  return { result, projectHash, scanId };
}
