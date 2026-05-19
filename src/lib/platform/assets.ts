type ViteImportMeta = ImportMeta & {
  env?: {
    BASE_URL?: string;
  };
};

function getBaseUrl() {
  const baseUrl = ((import.meta as ViteImportMeta).env?.BASE_URL ?? "/").trim();
  if (!baseUrl || baseUrl === "/") {
    return "/";
  }

  return baseUrl.endsWith("/") ? baseUrl : `${baseUrl}/`;
}

export function publicAssetPath(path: string) {
  if (/^(?:https?:|mailto:|tel:|data:|blob:|#)/i.test(path)) {
    return path;
  }

  const normalizedPath = path.replace(/^\.\//, "").replace(/^\//, "");
  return `${getBaseUrl()}${normalizedPath}`;
}
