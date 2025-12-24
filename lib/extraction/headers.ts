import type { SecurityHeaders } from '../types/mod';

export const headersToRecord = (headers: Headers): Record<string, string> => {
  const record: Record<string, string> = {};
  headers.forEach((value, key) => {
    record[key] = value;
  });
  return record;
};

export const extractSecurityHeaders = (headers: Record<string, string>): SecurityHeaders => ({
  hsts: headers['strict-transport-security'] ?? null,
  csp: headers['content-security-policy'] ?? null,
  xFrameOptions: headers['x-frame-options'] ?? null,
  xContentTypeOptions: headers['x-content-type-options'] ?? null,
});
