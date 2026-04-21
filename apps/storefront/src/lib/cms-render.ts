/**
 * Minimal, safe Markdown → HTML renderer for CMS page content.
 *
 * We deliberately do NOT pull a full markdown library to keep the bundle lean
 * and the server surface small. This covers headings (h1-h3), paragraphs,
 * bold/italic, links, unordered + ordered lists, and inline code. Any raw
 * HTML in the source is escaped first, so content is XSS-safe even if an
 * admin pastes `<script>` into the editor.
 *
 * If the content already looks like HTML (starts with <) we trust it — the
 * editor UI must sanitize before persist — and return it untouched. This
 * gives us a migration path toward a full WYSIWYG later.
 */
export function renderCmsContent(source: string): string {
  const trimmed = source.trim();
  if (trimmed.startsWith('<')) {
    // Heuristic: if first character is '<' treat as pre-rendered HTML.
    return source;
  }
  return markdownToHtml(source);
}

function escapeHtml(s: string): string {
  return s
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

function inline(s: string): string {
  let out = escapeHtml(s);
  // `code`
  out = out.replace(/`([^`]+)`/g, '<code>$1</code>');
  // **bold**
  out = out.replace(/\*\*([^*]+)\*\*/g, '<strong>$1</strong>');
  // *italic*
  out = out.replace(/(?<!\*)\*(?!\*)([^*]+)\*/g, '<em>$1</em>');
  // [text](url) — url must be http(s) or relative
  out = out.replace(
    /\[([^\]]+)\]\((https?:\/\/[^\s)]+|\/[^\s)]*)\)/g,
    (_m, text: string, url: string) =>
      `<a href="${url}" rel="noopener">${text}</a>`,
  );
  return out;
}

function markdownToHtml(md: string): string {
  const lines = md.replace(/\r\n/g, '\n').split('\n');
  const html: string[] = [];
  let i = 0;

  while (i < lines.length) {
    const line = lines[i] ?? '';

    // blank line
    if (!line.trim()) {
      i += 1;
      continue;
    }

    // headings
    const h = /^(#{1,3})\s+(.+)$/.exec(line);
    if (h) {
      const level = h[1].length;
      html.push(`<h${level}>${inline(h[2])}</h${level}>`);
      i += 1;
      continue;
    }

    // ordered list
    if (/^\s*\d+\.\s+/.test(line)) {
      const items: string[] = [];
      while (i < lines.length && /^\s*\d+\.\s+/.test(lines[i] ?? '')) {
        items.push(inline((lines[i] ?? '').replace(/^\s*\d+\.\s+/, '')));
        i += 1;
      }
      html.push('<ol>' + items.map((t) => `<li>${t}</li>`).join('') + '</ol>');
      continue;
    }

    // unordered list
    if (/^\s*[-*]\s+/.test(line)) {
      const items: string[] = [];
      while (i < lines.length && /^\s*[-*]\s+/.test(lines[i] ?? '')) {
        items.push(inline((lines[i] ?? '').replace(/^\s*[-*]\s+/, '')));
        i += 1;
      }
      html.push('<ul>' + items.map((t) => `<li>${t}</li>`).join('') + '</ul>');
      continue;
    }

    // paragraph — consume until blank / heading / list
    const para: string[] = [line];
    i += 1;
    while (
      i < lines.length &&
      lines[i] &&
      lines[i].trim().length > 0 &&
      !/^(#{1,3})\s+/.test(lines[i]) &&
      !/^\s*[-*]\s+/.test(lines[i]) &&
      !/^\s*\d+\.\s+/.test(lines[i])
    ) {
      para.push(lines[i]);
      i += 1;
    }
    html.push(`<p>${inline(para.join(' '))}</p>`);
  }

  return html.join('\n');
}
