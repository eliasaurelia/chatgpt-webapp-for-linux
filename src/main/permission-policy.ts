import { isCoreOpenAiResource } from '../shared/url-policy.ts';

const ALLOWED_PERMISSIONS = new Set([
  'notifications',
  'media',
  'clipboard-sanitized-write',
  'display-capture',
]);

export function shouldGrantPermission(permission: string, requestingUrl: string): boolean {
  return ALLOWED_PERMISSIONS.has(permission) && isCoreOpenAiResource(requestingUrl);
}

