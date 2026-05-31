export type NavigationClassification = 'internal' | 'external';

const INTERNAL_NAVIGATION_HOSTS = [
  'chatgpt.com',
  'chat.openai.com',
  'auth.openai.com',
  'login.openai.com',
  'accounts.openai.com',
  'platform.openai.com',
] as const;

const CORE_OPENAI_RESOURCE_HOSTS = [
  'chatgpt.com',
  'chat.openai.com',
  'openai.com',
  'oaistatic.com',
  'oaiusercontent.com',
  'oaicdn.com',
  'openaiusercontent.com',
] as const;

function parseUrl(value: string): URL | null {
  try {
    return new URL(value);
  } catch {
    return null;
  }
}

function isHttpUrl(url: URL): boolean {
  return url.protocol === 'https:' || url.protocol === 'http:';
}

function hostMatches(host: string, base: string): boolean {
  return host === base || host.endsWith(`.${base}`);
}

export function normalizeHost(value: string): string | null {
  const url = parseUrl(value);
  return url?.hostname.toLowerCase() ?? null;
}

export function classifyNavigation(value: string): NavigationClassification {
  const url = parseUrl(value);
  if (!url || !isHttpUrl(url)) {
    return 'external';
  }

  const host = url.hostname.toLowerCase();
  return INTERNAL_NAVIGATION_HOSTS.some((allowed) => hostMatches(host, allowed))
    ? 'internal'
    : 'external';
}

export function shouldOpenExternally(value: string): boolean {
  return classifyNavigation(value) === 'external';
}

export function isCoreOpenAiResource(value: string): boolean {
  const url = parseUrl(value);
  if (!url || !isHttpUrl(url)) {
    return false;
  }

  const host = url.hostname.toLowerCase();
  return CORE_OPENAI_RESOURCE_HOSTS.some((allowed) => hostMatches(host, allowed));
}

