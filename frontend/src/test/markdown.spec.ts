import { describe, expect, it } from "vitest";

import { renderMarkdown } from "../lib/markdown";

describe("renderMarkdown", () => {
  it("renders the current supported goal-brief markdown subset", () => {
    const html = renderMarkdown(`
# Goal title

**Strong signal** and *emphasis* with \`callback_ready\`.

| Signal | Expectation |
| --- | --- |
| Evidence | readable |

- Evidence clarity
- Operator intent

> Keep Codex idle during long work.
`);

    expect(html).toContain("<h3>Goal title</h3>");
    expect(html).toContain("<strong>Strong signal</strong>");
    expect(html).toContain("<em>emphasis</em>");
    expect(html).toContain("<code>callback_ready</code>");
    expect(html).toContain('class="markdown-table-scroll"');
    expect(html).toContain("<td>Evidence</td>");
    expect(html).toContain("<li>Evidence clarity</li>");
    expect(html).toContain("<blockquote>");
  });

  it("escapes unsafe HTML while preserving safe links", () => {
    const html = renderMarkdown("[docs](https://example.com/docs) <script>alert(1)</script>");

    expect(html).toContain('href="https://example.com/docs"');
    expect(html).toContain("&lt;script&gt;alert(1)&lt;/script&gt;");
    expect(html).not.toContain("<script>");
  });

  it("uses the empty preview text for blank input", () => {
    expect(renderMarkdown("")).toBe('<p class="markdown-empty">Markdown preview appears here.</p>');
  });
});
