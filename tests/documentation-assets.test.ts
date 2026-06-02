import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { documentationAssetPath, getBundledLessonMarkdown } from "../src/lib/content/documentation-assets";
import { lessonRegistry } from "../src/lib/content/lessons";
import { renderMarkdown } from "../src/lib/content/markdown";

test("every registered lesson is available without a runtime fetch", () => {
  for (const lesson of lessonRegistry) {
    assert.ok(getBundledLessonMarkdown(lesson.file).length > 0, `${lesson.id} should have bundled markdown`);
  }

  const learnBrowserSource = readFileSync("src/components/content/learn-browser.tsx", "utf8");
  assert.doesNotMatch(learnBrowserSource, /\bfetch\s*\(/);
});

test("documentation help diagrams render as bundled data URLs", () => {
  const assetPath = documentationAssetPath("assets/help/pid-terms-overview.svg");
  const html = renderMarkdown("![PID terms](assets/help/pid-terms-overview.svg)");

  assert.match(assetPath, /^data:image\/svg\+xml;base64,/);
  assert.match(html, /src="data:image\/svg\+xml;base64,/);
});
