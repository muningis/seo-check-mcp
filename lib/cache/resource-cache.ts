import type { Resource } from '../types/mod';
import { headersToRecord } from '../extraction/mod';

const RESOURCES_CACHE: Record<string, Resource> = {};

export const retrieveResource = async (
  hostname: string,
  url: string,
  headers: Record<string, string>
): Promise<Resource> => {
  const fullUrl = url.startsWith('/') ? `${hostname}${url}` : url;
  if (fullUrl in RESOURCES_CACHE)
    return RESOURCES_CACHE[fullUrl]!;

  const res = await fetch(fullUrl, { headers });
  const resHeaders = headersToRecord(res.headers);
  const resource = {
    url: fullUrl,
    headers: resHeaders,
    mime: (resHeaders['Content-Type'] || resHeaders['content-type']) ?? 'application/octet-stream'
  };

  RESOURCES_CACHE[fullUrl] = resource;
  return resource;
};

export const retrieveResources = async (
  hostname: string,
  urls: string[],
  headers: Record<string, string>
): Promise<Resource[]> => {
  return await Promise.all(urls.map(url => retrieveResource(hostname, url, headers)));
};

export const clearResourceCache = (): void => {
  for (const key in RESOURCES_CACHE) {
    delete RESOURCES_CACHE[key];
  }
};
