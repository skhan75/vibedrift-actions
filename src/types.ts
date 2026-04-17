export interface ScanResult {
  compositeScore: number;
  maxCompositeScore: number;
  findings: Finding[];
  scanTimeMs: number;
  context: {
    files: { relativePath: string }[];
    dominantLanguage: string | null;
    totalLines: number;
  };
}

export interface Finding {
  analyzerId: string;
  severity: "info" | "warning" | "error";
  confidence: number;
  message: string;
  locations: { file: string; line?: number }[];
  tags: string[];
  consistencyImpact?: number;
  metadata?: {
    dominantPattern?: string;
    dominantFiles?: string[];
    intentDivergence?: { declaredLabel: string; source: string };
  };
}

export interface BaselineScan {
  scan_id: string;
  score: number;
  grade: string;
  finding_count: number;
  drift_count: number;
  is_deep: boolean;
  scanned_at: string;
}

export interface Delta {
  score: number;
  findings: number;
  newDrifts: Finding[];
  direction: "up" | "down" | "stable";
}

export interface ActionInputs {
  token: string;
  path: string;
  failOnScore: number | null;
  deep: boolean;
  comment: boolean;
  commentOnPass: boolean;
}
