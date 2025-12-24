import { z } from 'zod/v3';
import { parse as parseHTML } from 'node-html-parser';
import type { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { DEFAULT_HEADERS } from '../config/mod';
import { extractLinks } from '../extraction/mod';

interface LinkCheckResult {
  url: string;
  status: number | 'error';
  isRedirect: boolean;
  redirectTo?: string;
  errorMessage?: string;
}

interface BrokenLinksResult {
  pageUrl: string;
  totalLinks: number;
  checkedLinks: number;
  brokenLinks: LinkCheckResult[];
  redirects: LinkCheckResult[];
  workingLinks: number;
  summary: {
    broken: number;
    redirects: number;
    errors: number;
    working: number;
  };
  suggestions: string[];
}

export const registerFindBrokenLinks = (server: McpServer): void => {
  // @ts-ignore - Deep type instantiation with Zod/MCP SDK
  server.registerTool('find-broken-links', {
    description: 'Detect broken links and redirect chains on a page with status codes and fix suggestions',
    inputSchema: {
      url: z.string().describe('Full URL to check for broken links'),
      hostname: z.string().describe('Hostname for internal link detection'),
      checkExternal: z.boolean().optional().describe('Also check external links (slower, default: false)'),
      maxLinks: z.number().optional().describe('Maximum links to check (default: 50)'),
    },
  }, async ({ url, hostname, checkExternal = false, maxLinks = 50 }) => {
    const res = await fetch(url, { headers: DEFAULT_HEADERS });
    const html = await res.text();
    const dom = parseHTML(html);

    const links = extractLinks(dom, hostname);
    const linksToCheck = checkExternal
      ? [...links.internal, ...links.external]
      : links.internal;

    // Deduplicate and limit
    const uniqueLinks = [...new Set(linksToCheck.map(l => normalizeUrl(l.href, hostname)))];
    const limitedLinks = uniqueLinks.slice(0, maxLinks);

    const brokenLinks: LinkCheckResult[] = [];
    const redirects: LinkCheckResult[] = [];
    let workingLinks = 0;
    let errors = 0;

    // Check links in parallel batches
    const batchSize = 10;
    for (let i = 0; i < limitedLinks.length; i += batchSize) {
      const batch = limitedLinks.slice(i, i + batchSize);
      const results = await Promise.all(
        batch.map(href => checkLink(href, hostname))
      );

      for (const result of results) {
        if (result.status === 'error') {
          brokenLinks.push(result);
          errors++;
        } else if (result.status >= 400) {
          brokenLinks.push(result);
        } else if (result.isRedirect) {
          redirects.push(result);
        } else {
          workingLinks++;
        }
      }
    }

    // Generate suggestions
    const suggestions: string[] = [];

    if (brokenLinks.length > 0) {
      suggestions.push(`Fix ${brokenLinks.length} broken links to improve user experience and SEO`);

      const notFoundLinks = brokenLinks.filter(l => l.status === 404);
      if (notFoundLinks.length > 0) {
        suggestions.push(`${notFoundLinks.length} links return 404 - update or remove these links`);
      }

      const serverErrors = brokenLinks.filter(l => typeof l.status === 'number' && l.status >= 500);
      if (serverErrors.length > 0) {
        suggestions.push(`${serverErrors.length} links return server errors - investigate server issues`);
      }
    }

    if (redirects.length > 0) {
      suggestions.push(`Update ${redirects.length} links that redirect to their final destinations`);

      const chainedRedirects = redirects.filter(r =>
        r.redirectTo && r.redirectTo !== r.url
      );
      if (chainedRedirects.length > 0) {
        suggestions.push('Redirect chains waste crawl budget - link directly to final URLs');
      }
    }

    if (limitedLinks.length < uniqueLinks.length) {
      suggestions.push(`Only checked ${maxLinks} of ${uniqueLinks.length} links. Increase maxLinks for complete analysis.`);
    }

    const result: BrokenLinksResult = {
      pageUrl: url,
      totalLinks: uniqueLinks.length,
      checkedLinks: limitedLinks.length,
      brokenLinks,
      redirects,
      workingLinks,
      summary: {
        broken: brokenLinks.length - errors,
        redirects: redirects.length,
        errors,
        working: workingLinks,
      },
      suggestions,
    };

    return {
      content: [{
        type: 'text',
        text: JSON.stringify(result, null, 2),
      }],
    };
  });
};

async function checkLink(href: string, hostname: string): Promise<LinkCheckResult> {
  const fullUrl = href.startsWith('/') ? `${hostname}${href}` : href;

  try {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 10000);

    const response = await fetch(fullUrl, {
      method: 'HEAD',
      headers: DEFAULT_HEADERS,
      redirect: 'manual',
      signal: controller.signal,
    });

    clearTimeout(timeoutId);

    const isRedirect = response.status >= 300 && response.status < 400;
    const redirectTo = isRedirect ? response.headers.get('location') ?? undefined : undefined;

    return {
      url: fullUrl,
      status: response.status,
      isRedirect,
      redirectTo,
    };
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unknown error';

    // Retry with GET if HEAD fails
    try {
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 10000);

      const response = await fetch(fullUrl, {
        method: 'GET',
        headers: DEFAULT_HEADERS,
        redirect: 'manual',
        signal: controller.signal,
      });

      clearTimeout(timeoutId);

      const isRedirect = response.status >= 300 && response.status < 400;
      const redirectTo = isRedirect ? response.headers.get('location') ?? undefined : undefined;

      return {
        url: fullUrl,
        status: response.status,
        isRedirect,
        redirectTo,
      };
    } catch {
      return {
        url: fullUrl,
        status: 'error',
        isRedirect: false,
        errorMessage: message,
      };
    }
  }
}

function normalizeUrl(href: string, hostname: string): string {
  if (href.startsWith('/')) {
    return href;
  }
  try {
    const url = new URL(href);
    return url.href;
  } catch {
    return `${hostname}${href.startsWith('/') ? '' : '/'}${href}`;
  }
}
