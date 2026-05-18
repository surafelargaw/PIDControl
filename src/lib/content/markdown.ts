function escapeHtml(value: string) {
  return String(value)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

function inlineFormat(text: string) {
  let html = escapeHtml(text);
  html = html.replace(/\[([^\]]+)\]\(([^)]+)\)/g, (_match, label, href) => {
    const adjustedHref = String(href).replace(/^assets\/help\//, "/legacy/help/");
    if (/^(?:javascript|data|vbscript):/i.test(adjustedHref.trim())) {
      return label;
    }
    return `<a href="${adjustedHref}" target="_blank" rel="noreferrer">${label}</a>`;
  });
  html = html.replace(/\*\*([^*]+)\*\*/g, "<strong>$1</strong>");
  html = html.replace(/`([^`]+)`/g, "<code>$1</code>");
  return html;
}

export function slugifyHeading(text: string) {
  return text
    .toLowerCase()
    .replace(/`([^`]+)`/g, "$1")
    .replace(/&amp;/g, "and")
    .replace(/&/g, "and")
    .replace(/[^a-z0-9\s-]/g, "")
    .trim()
    .replace(/\s+/g, "-")
    .replace(/-+/g, "-") || "section";
}

function uniqueHeadingId(text: string, headingCounts: Map<string, number>) {
  const baseId = slugifyHeading(text);
  const count = (headingCounts.get(baseId) ?? 0) + 1;
  headingCounts.set(baseId, count);
  return count === 1 ? baseId : `${baseId}-${count}`;
}

function isTableStart(lines: string[], index: number) {
  if (index + 1 >= lines.length) {
    return false;
  }

  const current = lines[index].trim();
  const next = lines[index + 1].trim();
  return current.includes("|") && /^[:|\-\s]+$/.test(next);
}

function splitTableRow(row: string) {
  return row
    .replace(/^\|/, "")
    .replace(/\|$/, "")
    .split("|")
    .map((cell) => cell.trim());
}

function parseTable(lines: string[], startIndex: number) {
  const tableLines: string[] = [];
  let index = startIndex;

  while (index < lines.length && lines[index].trim()) {
    tableLines.push(lines[index].trim());
    index += 1;
  }

  const headers = splitTableRow(tableLines[0]);
  const rows = tableLines.slice(2).map(splitTableRow);
  const html = `
    <div class="table-card">
      <table class="table">
        <thead>
          <tr>${headers.map((cell) => `<th>${inlineFormat(cell)}</th>`).join("")}</tr>
        </thead>
        <tbody>
          ${rows
            .map((row) => `<tr>${row.map((cell) => `<td>${inlineFormat(cell)}</td>`).join("")}</tr>`)
            .join("")}
        </tbody>
      </table>
    </div>
  `;

  return { html, nextIndex: index };
}

function isImageLine(trimmed: string) {
  return /^!\[([^\]]*)\]\(([^)]+)\)\s*$/.test(trimmed);
}

function parseImageLine(trimmed: string) {
  const match = trimmed.match(/^!\[([^\]]*)\]\(([^)]+)\)\s*$/);
  if (!match) {
    return "";
  }

  const [, alt, src] = match;
  const safeAlt = escapeHtml(alt || "Illustration");
  const adjustedSrc = escapeHtml(String(src).replace(/^assets\/help\//, "/legacy/help/"));

  return `
    <figure class="lesson-figure">
      <img src="${adjustedSrc}" alt="${safeAlt}" loading="lazy" style="max-width:100%;border-radius:20px;border:1px solid rgba(148,163,184,.18)" />
      <figcaption class="muted">${safeAlt}</figcaption>
    </figure>
  `;
}

function isWidgetDirective(trimmed: string) {
  return /^<!--\s*widget:[\w-]+\s*-->$/.test(trimmed);
}

function parseWidgetDirective(trimmed: string) {
  const match = trimmed.match(/^<!--\s*widget:([\w-]+)\s*-->$/);
  if (!match) {
    return null;
  }
  return match[1];
}

function isBlockBoundary(lines: string[], index: number) {
  const trimmed = lines[index].trim();
  return (
    /^#{1,3}\s+/.test(trimmed) ||
    /^---+$/.test(trimmed) ||
    isImageLine(trimmed) ||
    /^>\s?/.test(trimmed) ||
    /^[-*]\s+/.test(trimmed) ||
    /^\d+\.\s+/.test(trimmed) ||
    /^```/.test(trimmed) ||
    isWidgetDirective(trimmed) ||
    isTableStart(lines, index)
  );
}

function parseList(lines: string[], startIndex: number, listType: "ul" | "ol") {
  const itemPattern = listType === "ul" ? /^[-*]\s+/ : /^\d+\.\s+/;
  const items: string[] = [];
  let index = startIndex;

  while (index < lines.length && itemPattern.test(lines[index].trim())) {
    items.push(lines[index].trim().replace(itemPattern, ""));
    index += 1;
  }

  return {
    html: `<${listType}>${items.map((item) => `<li>${inlineFormat(item)}</li>`).join("")}</${listType}>`,
    nextIndex: index
  };
}

function parseBlockquote(lines: string[], startIndex: number) {
  const quoteLines: string[] = [];
  let index = startIndex;

  while (index < lines.length && /^>\s?/.test(lines[index].trim())) {
    quoteLines.push(lines[index].replace(/^>\s?/, "").trim());
    index += 1;
  }

  return {
    html: `<blockquote><p>${inlineFormat(quoteLines.join(" "))}</p></blockquote>`,
    nextIndex: index
  };
}

function parseFencedCode(lines: string[], startIndex: number) {
  // Skip the opening ``` line (may include a language hint like ```typescript)
  let index = startIndex + 1;
  const codeLines: string[] = [];

  while (index < lines.length) {
    if (/^```/.test(lines[index].trim())) {
      index += 1; // skip closing ```
      break;
    }
    codeLines.push(lines[index]);
    index += 1;
  }

  const escaped = codeLines.map((line) =>
    line.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;")
  ).join("\n");

  return {
    html: `<pre><code>${escaped}</code></pre>`,
    nextIndex: index
  };
}

export function renderMarkdown(markdown: string) {
  const lines = markdown.replace(/\r/g, "").split("\n");
  const blocks: string[] = [];
  const headingCounts = new Map<string, number>();
  let index = 0;

  while (index < lines.length) {
    const trimmed = lines[index].trim();
    if (!trimmed) {
      index += 1;
      continue;
    }

    if (/^```/.test(trimmed)) {
      const parsed = parseFencedCode(lines, index);
      blocks.push(parsed.html);
      index = parsed.nextIndex;
      continue;
    }

    if (/^#{1,3}\s+/.test(trimmed)) {
      const depth = trimmed.match(/^#+/)?.[0].length ?? 1;
      const content = trimmed.replace(/^#{1,3}\s+/, "");
      const headingId = uniqueHeadingId(content, headingCounts);
      blocks.push(`<h${depth} id="${headingId}"><a class="heading-anchor" href="#${headingId}">${inlineFormat(content)}</a></h${depth}>`);
      index += 1;
      continue;
    }

    if (/^---+$/.test(trimmed)) {
      blocks.push("<hr />");
      index += 1;
      continue;
    }

    if (isTableStart(lines, index)) {
      const parsed = parseTable(lines, index);
      blocks.push(parsed.html);
      index = parsed.nextIndex;
      continue;
    }

    if (isImageLine(trimmed)) {
      blocks.push(parseImageLine(trimmed));
      index += 1;
      continue;
    }

    if (isWidgetDirective(trimmed)) {
      const widgetId = parseWidgetDirective(trimmed);
      if (widgetId) {
        blocks.push(`<div data-widget="${widgetId}" class="lesson-widget-slot"></div>`);
      }
      index += 1;
      continue;
    }

    if (/^>\s?/.test(trimmed)) {
      const parsed = parseBlockquote(lines, index);
      blocks.push(parsed.html);
      index = parsed.nextIndex;
      continue;
    }

    if (/^[-*]\s+/.test(trimmed)) {
      const parsed = parseList(lines, index, "ul");
      blocks.push(parsed.html);
      index = parsed.nextIndex;
      continue;
    }

    if (/^\d+\.\s+/.test(trimmed)) {
      const parsed = parseList(lines, index, "ol");
      blocks.push(parsed.html);
      index = parsed.nextIndex;
      continue;
    }

    const paragraph: string[] = [];
    while (index < lines.length && lines[index].trim() && !isBlockBoundary(lines, index)) {
      paragraph.push(lines[index].trim());
      index += 1;
    }
    blocks.push(`<p>${inlineFormat(paragraph.join(" "))}</p>`);
  }

  return blocks.join("");
}
