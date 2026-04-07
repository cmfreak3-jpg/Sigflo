export type DeepSection = { heading: string; text: string };

/**
 * Splits AI markdown body on `##` headings. Preamble before the first heading becomes section "Overview"
 * if non-empty; otherwise sections are only explicit ## blocks.
 */
export function parseDeepAnalysisSections(markdown: string): DeepSection[] {
  const raw = markdown.trim();
  if (!raw) return [];

  const lines = raw.split(/\r?\n/);
  const sections: DeepSection[] = [];
  let preamble: string[] = [];
  let current: { heading: string; lines: string[] } | null = null;

  const flushCurrent = () => {
    if (!current) return;
    const text = current.lines.join('\n').trim();
    if (text.length > 0 || current.heading.length > 0) {
      sections.push({ heading: current.heading, text });
    }
    current = null;
  };

  for (const line of lines) {
    const m = /^#{2,3}\s+(.+)$/.exec(line.trim());
    if (m) {
      if (!current && preamble.length > 0) {
        const p = preamble.join('\n').trim();
        if (p) sections.push({ heading: 'Overview', text: p });
        preamble = [];
      }
      flushCurrent();
      current = { heading: m[1].trim(), lines: [] };
    } else if (current) {
      current.lines.push(line);
    } else {
      preamble.push(line);
    }
  }
  flushCurrent();

  if (sections.length === 0 && preamble.length > 0) {
    const p = preamble.join('\n').trim();
    if (p) return [{ heading: 'Analysis', text: p }];
  }

  return sections.length > 0 ? sections : [{ heading: 'Analysis', text: raw }];
}
