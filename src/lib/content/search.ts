import { slugifyHeading } from "@/lib/content/markdown";

export type LessonSearchSource = {
  id: string;
  title: string;
  file: string;
};

export type LessonSearchSection = {
  lessonId: string;
  lessonTitle: string;
  heading: string;
  headingId: string;
  body: string;
};

export type LessonSearchResult = LessonSearchSection & {
  score: number;
  snippet: string;
};

function normalizeText(value: string) {
  return value.toLowerCase().replace(/\s+/g, " ").trim();
}

function stripMarkdown(value: string) {
  return value
    .replace(/<!--[\s\S]*?-->/g, " ")
    .replace(/!\[([^\]]*)\]\([^)]+\)/g, "$1")
    .replace(/\[([^\]]+)\]\([^)]+\)/g, "$1")
    .replace(/`([^`]+)`/g, "$1")
    .replace(/\*\*([^*]+)\*\*/g, "$1")
    .replace(/^#{1,6}\s+/gm, "")
    .replace(/^>\s?/gm, "")
    .replace(/^\s*[-*]\s+/gm, "")
    .replace(/^\s*\d+\.\s+/gm, "")
    .replace(/[|:_\-]{3,}/g, " ")
    .replace(/[|]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function uniqueHeadingId(text: string, headingCounts: Map<string, number>) {
  const baseId = slugifyHeading(text);
  const count = (headingCounts.get(baseId) ?? 0) + 1;
  headingCounts.set(baseId, count);
  return count === 1 ? baseId : `${baseId}-${count}`;
}

export function buildLessonSearchSections(lesson: LessonSearchSource, markdown: string): LessonSearchSection[] {
  const lines = markdown.replace(/\r/g, "").split("\n");
  const headingCounts = new Map<string, number>();
  const sections: LessonSearchSection[] = [];
  let active:
    | {
        heading: string;
        headingId: string;
        bodyLines: string[];
      }
    | null = null;

  const flush = () => {
    if (!active) {
      return;
    }

    sections.push({
      lessonId: lesson.id,
      lessonTitle: lesson.title,
      heading: active.heading,
      headingId: active.headingId,
      body: stripMarkdown(active.bodyLines.join("\n"))
    });
  };

  for (const line of lines) {
    const headingMatch = line.match(/^(#{1,3})\s+(.+)$/);
    if (headingMatch) {
      flush();
      const heading = stripMarkdown(headingMatch[2]);
      active = {
        heading,
        headingId: uniqueHeadingId(headingMatch[2], headingCounts),
        bodyLines: []
      };
      continue;
    }

    if (!active) {
      active = {
        heading: lesson.title,
        headingId: slugifyHeading(lesson.title),
        bodyLines: []
      };
    }
    active.bodyLines.push(line);
  }

  flush();

  return sections;
}

function buildSnippet(text: string, query: string, terms: string[]) {
  const normalized = normalizeText(text);
  const normalizedQuery = normalizeText(query);
  let index = normalized.indexOf(normalizedQuery);

  if (index < 0) {
    const firstTerm = terms.find((term) => normalized.includes(term));
    index = firstTerm ? normalized.indexOf(firstTerm) : 0;
  }

  const start = Math.max(0, index - 70);
  const end = Math.min(text.length, index + 150);
  const prefix = start > 0 ? "... " : "";
  const suffix = end < text.length ? " ..." : "";
  return `${prefix}${text.slice(start, end).trim()}${suffix}`;
}

export function searchLessonSections(
  sections: LessonSearchSection[],
  query: string,
  maxResults = 12
): LessonSearchResult[] {
  const normalizedQuery = normalizeText(query);
  if (normalizedQuery.length < 2) {
    return [];
  }

  const terms = Array.from(new Set(normalizedQuery.split(/\s+/).filter((term) => term.length >= 2)));
  if (!terms.length) {
    return [];
  }

  return sections
    .map((section) => {
      const title = normalizeText(section.lessonTitle);
      const heading = normalizeText(section.heading);
      const body = normalizeText(section.body);
      const combined = `${title} ${heading} ${body}`;
      const allTermsMatch = terms.every((term) => combined.includes(term));

      if (!allTermsMatch) {
        return null;
      }

      let score = 0;
      if (title.includes(normalizedQuery)) score += 12;
      if (heading.includes(normalizedQuery)) score += 10;
      if (body.includes(normalizedQuery)) score += 5;

      for (const term of terms) {
        if (title.includes(term)) score += 4;
        if (heading.includes(term)) score += 3;
        if (body.includes(term)) score += 1;
      }

      return {
        ...section,
        score,
        snippet: buildSnippet(`${section.heading}. ${section.body}`, query, terms)
      };
    })
    .filter((result): result is LessonSearchResult => result !== null)
    .sort((left, right) => right.score - left.score || left.lessonTitle.localeCompare(right.lessonTitle))
    .slice(0, maxResults);
}
