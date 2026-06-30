import { escapeAttribute, escapeHtml } from "./format";

export function renderInlineMarkdown(text: unknown): string {
  const tokens: Array<[string, string]> = [];
  const token = (html: string): string => {
    const placeholder = `@@MDTOKEN${tokens.length}@@`;
    tokens.push([placeholder, html]);
    return placeholder;
  };
  let source = `${text ?? ""}`;
  source = source.replace(/`([^`]+)`/g, (_match, code: string) => token(`<code>${escapeHtml(code)}</code>`));
  source = source.replace(/\[([^\]]+)\]\((https?:\/\/[^)\s]+)\)/g, (_match, label: string, href: string) => {
    return token(`<a href="${escapeAttribute(href)}" target="_blank" rel="noopener noreferrer">${escapeHtml(label)}</a>`);
  });
  let html = escapeHtml(source);
  html = html.replace(/\*\*([^*]+)\*\*/g, "<strong>$1</strong>");
  html = html.replace(/(^|[^*])\*([^*\n]+)\*/g, "$1<em>$2</em>");
  for (const [placeholder, value] of tokens) html = html.replaceAll(placeholder, value);
  return html;
}

export function splitMarkdownTableRow(line: string): string[] | null {
  const trimmed = line.trim();
  if (!trimmed.startsWith("|") || !trimmed.endsWith("|")) return null;
  return trimmed
    .slice(1, -1)
    .split("|")
    .map((cell) => cell.trim());
}

export function isMarkdownTableDivider(line: string): boolean {
  const cells = splitMarkdownTableRow(line);
  return Boolean(cells?.length) && Boolean(cells?.every((cell) => /^:?-{3,}:?$/.test(cell)));
}

export function renderMarkdownTable(headerLine: string, dividerLine: string, bodyLines: string[]): string | null {
  const headers = splitMarkdownTableRow(headerLine) || [];
  const divider = splitMarkdownTableRow(dividerLine) || [];
  const rows = bodyLines.map((line) => splitMarkdownTableRow(line)).filter((row): row is string[] => Boolean(row));
  if (!headers.length || !divider.length || headers.length !== divider.length) return null;
  return `
    <div class="markdown-table-scroll">
      <table>
        <thead>
          <tr>${headers.map((cell) => `<th>${renderInlineMarkdown(cell)}</th>`).join("")}</tr>
        </thead>
        <tbody>
          ${rows
            .map(
              (row) => `
                <tr>${headers.map((_header, index) => `<td>${renderInlineMarkdown(row[index] || "")}</td>`).join("")}</tr>
              `
            )
            .join("")}
        </tbody>
      </table>
    </div>
  `;
}

export function renderMarkdown(markdown: unknown, emptyText = "Markdown preview appears here."): string {
  const source = `${markdown || ""}`.trim();
  if (!source) return `<p class="markdown-empty">${escapeHtml(emptyText)}</p>`;
  const lines = source.replace(/\r\n/g, "\n").split("\n");
  const blocks: string[] = [];
  let paragraph: string[] = [];
  let listItems: string[] = [];
  let quoteLines: string[] = [];
  let codeLines: string[] = [];
  let inCodeBlock = false;

  const flushParagraph = () => {
    if (!paragraph.length) return;
    blocks.push(`<p>${renderInlineMarkdown(paragraph.join(" "))}</p>`);
    paragraph = [];
  };
  const flushList = () => {
    if (!listItems.length) return;
    blocks.push(`<ul>${listItems.map((item) => `<li>${renderInlineMarkdown(item)}</li>`).join("")}</ul>`);
    listItems = [];
  };
  const flushQuote = () => {
    if (!quoteLines.length) return;
    blocks.push(`<blockquote>${quoteLines.map((line) => `<p>${renderInlineMarkdown(line)}</p>`).join("")}</blockquote>`);
    quoteLines = [];
  };
  const flushTextBlocks = () => {
    flushParagraph();
    flushList();
    flushQuote();
  };

  for (let index = 0; index < lines.length; index += 1) {
    const rawLine = lines[index];
    const line = rawLine.replace(/\s+$/g, "");
    if (line.trim().startsWith("```")) {
      if (inCodeBlock) {
        blocks.push(`<pre><code>${escapeHtml(codeLines.join("\n"))}</code></pre>`);
        codeLines = [];
        inCodeBlock = false;
      } else {
        flushTextBlocks();
        inCodeBlock = true;
      }
      continue;
    }
    if (inCodeBlock) {
      codeLines.push(line);
      continue;
    }
    if (!line.trim()) {
      flushTextBlocks();
      continue;
    }
    if (splitMarkdownTableRow(line) && isMarkdownTableDivider(lines[index + 1] || "")) {
      flushTextBlocks();
      const bodyLines: string[] = [];
      let next = index + 2;
      while (next < lines.length && splitMarkdownTableRow(lines[next])) {
        bodyLines.push(lines[next]);
        next += 1;
      }
      const table = renderMarkdownTable(line, lines[index + 1], bodyLines);
      if (table) {
        blocks.push(table);
        index = next - 1;
        continue;
      }
    }
    const heading = /^(#{1,3})\s+(.+)$/.exec(line);
    if (heading) {
      flushTextBlocks();
      const level = heading[1].length + 2;
      blocks.push(`<h${level}>${renderInlineMarkdown(heading[2])}</h${level}>`);
      continue;
    }
    const list = /^\s*[-*]\s+(.+)$/.exec(line);
    if (list) {
      flushParagraph();
      flushQuote();
      listItems.push(list[1]);
      continue;
    }
    const quote = /^\s*>\s?(.+)$/.exec(line);
    if (quote) {
      flushParagraph();
      flushList();
      quoteLines.push(quote[1]);
      continue;
    }
    flushList();
    flushQuote();
    paragraph.push(line);
  }
  if (inCodeBlock) blocks.push(`<pre><code>${escapeHtml(codeLines.join("\n"))}</code></pre>`);
  flushTextBlocks();
  return blocks.join("");
}
