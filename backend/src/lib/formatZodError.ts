import type { ZodIssue } from 'zod';

function issuePath(issue: ZodIssue): string {
  if (!issue.path?.length) return 'request';
  return issue.path.map((p) => String(p)).join('.');
}

/**
 * Short, user-facing validation summary for API 400 responses (first issues only).
 * Uses Zod’s own messages (Zod 4) plus a clear path prefix.
 */
export function formatZodIssuesForApi(issues: ZodIssue[]): string {
  if (!issues.length) return 'Request did not match the expected format.';
  return issues
    .slice(0, 4)
    .map((issue) => {
      const path = issuePath(issue);
      const msg = typeof issue.message === 'string' && issue.message.trim() ? issue.message.trim() : 'Invalid value';
      return `${path}: ${msg}`;
    })
    .join(' · ');
}
