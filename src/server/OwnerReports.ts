import { createHash } from "crypto";

// AlexFront: the owner reads players' reports through the worker
// (/api/owner/reports), with their code in the x-owner-key header. Only a
// hash of the code lives here.
const OWNER_HASH =
  "e8dc279ed2f869c7e9ff06c93073f79e32c97fc84cdbfdcf641edda316810ce1";
const KEEP = 300;

export interface OwnerReport {
  at: number;
  gameID: string;
  reporter: string;
  reported: string;
  reason: string;
}

const recent: OwnerReport[] = [];

export function isOwnerKey(key: unknown): boolean {
  if (typeof key !== "string" || key.length === 0 || key.length > 64) {
    return false;
  }
  return createHash("sha256").update(key).digest("hex") === OWNER_HASH;
}

export function noteReport(report: OwnerReport): void {
  recent.push(report);
  if (recent.length > KEEP) recent.shift();
}

/** Newest first. */
export function recentReports(): OwnerReport[] {
  return [...recent].reverse();
}
