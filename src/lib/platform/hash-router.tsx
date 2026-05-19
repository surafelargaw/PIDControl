import {
  createContext,
  useContext,
  useEffect,
  useMemo,
  useState,
  type AnchorHTMLAttributes,
  type ReactNode
} from "react";

export type HashRoute = {
  path: string;
  search: string;
  params: URLSearchParams;
  anchor: string | null;
  raw: string;
};

const HashRouteContext = createContext<HashRoute | null>(null);

function safeDecode(value: string) {
  try {
    return decodeURIComponent(value);
  } catch {
    return value;
  }
}

function normalizePath(path: string) {
  if (!path || path === "#") {
    return "/";
  }

  const withSlash = path.startsWith("/") ? path : `/${path}`;
  return withSlash.length > 1 && withSlash.endsWith("/") ? withSlash.slice(0, -1) : withSlash;
}

function parseHash(hash: string): HashRoute {
  let raw = hash.startsWith("#") ? hash.slice(1) : hash;

  if (!raw) {
    raw = "/";
  }

  const anchorIndex = raw.indexOf("#");
  const pathAndSearch = anchorIndex >= 0 ? raw.slice(0, anchorIndex) : raw;
  const anchor = anchorIndex >= 0 ? safeDecode(raw.slice(anchorIndex + 1)) : null;
  const queryIndex = pathAndSearch.indexOf("?");
  const path = normalizePath(queryIndex >= 0 ? pathAndSearch.slice(0, queryIndex) : pathAndSearch);
  const search = queryIndex >= 0 ? pathAndSearch.slice(queryIndex + 1) : "";

  return {
    path,
    search,
    params: new URLSearchParams(search),
    anchor,
    raw
  };
}

function getCurrentRoute() {
  if (typeof window === "undefined") {
    return parseHash("#/");
  }

  return parseHash(window.location.hash);
}

export function toHashHref(href: string) {
  if (
    href.startsWith("#") ||
    href.startsWith("http://") ||
    href.startsWith("https://") ||
    href.startsWith("mailto:") ||
    href.startsWith("tel:")
  ) {
    return href;
  }

  if (href.startsWith("/")) {
    return `#${href}`;
  }

  if (href.startsWith("?")) {
    return `#/${href}`;
  }

  return href;
}

export function HashRouteProvider({ children }: Readonly<{ children: ReactNode }>) {
  const [route, setRoute] = useState<HashRoute>(() => getCurrentRoute());

  useEffect(() => {
    const handleHashChange = () => setRoute(getCurrentRoute());
    window.addEventListener("hashchange", handleHashChange);
    handleHashChange();
    return () => window.removeEventListener("hashchange", handleHashChange);
  }, []);

  const value = useMemo(() => route, [route]);

  return <HashRouteContext.Provider value={value}>{children}</HashRouteContext.Provider>;
}

export function useHashRoute() {
  const route = useContext(HashRouteContext);
  if (!route) {
    throw new Error("useHashRoute must be used within HashRouteProvider.");
  }
  return route;
}

export function AppLink({
  href,
  children,
  ...props
}: Readonly<AnchorHTMLAttributes<HTMLAnchorElement> & { href: string }>) {
  return (
    <a href={toHashHref(href)} {...props}>
      {children}
    </a>
  );
}
