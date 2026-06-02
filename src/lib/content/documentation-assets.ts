import { bundledHelpAssets, bundledLessonMarkdown } from "@/lib/content/generated-documentation";
import { publicAssetPath } from "@/lib/platform/assets";

function normalizePath(path: string) {
  const normalizedPath = path.replace(/\\/g, "/").replace(/^\.\//, "").replace(/^\//, "");
  return `/${normalizedPath}`;
}

export function getBundledLessonMarkdown(path: string) {
  const normalizedPath = normalizePath(path);
  const markdown = bundledLessonMarkdown[normalizedPath];

  if (!markdown) {
    throw new Error(`Bundled lesson content was not found for ${normalizedPath}.`);
  }

  return markdown;
}

export function documentationAssetPath(path: string) {
  if (/^(?:https?:|mailto:|tel:|data:|blob:|#)/i.test(path)) {
    return path;
  }

  const normalizedPath = normalizePath(path.replace(/^assets\/help\//, "/legacy/help/"));
  return bundledHelpAssets[normalizedPath] ?? publicAssetPath(normalizedPath);
}
