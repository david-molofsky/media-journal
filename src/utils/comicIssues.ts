/**
 * Derives the number of comic issues represented by an issue range.
 *
 * Per PRD section 5 ("Comic Fields"): issues 6–11 count as six issues.
 * This value is never stored — only derived (Database Schema & Data
 * Model, section 4 and section 8).
 */
export function comicIssueCount(issueStart: number, issueEnd: number): number {
  return issueEnd - issueStart + 1;
}
