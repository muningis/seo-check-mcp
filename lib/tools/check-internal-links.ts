import { z } from 'zod/v3';
import { parse as parseHTML } from 'node-html-parser';
import type { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { DEFAULT_HEADERS } from '../config/mod';
import { extractLinks } from '../extraction/mod';

interface InternalLinkAnalysis {
  url: string;
  hostname: string;
  totalInternalLinks: number;
  uniqueInternalLinks: number;
  analysis: {
    linksByAnchorText: Record<string, number>;
    linksByTarget: Record<string, number>;
    linksByDepth: Record<number, number>;
    nofollowLinks: number;
    emptyAnchorLinks: number;
    genericAnchorLinks: number;
  };
  topLinkedPages: Array<{ url: string; count: number }>;
  issues: string[];
  suggestions: string[];
}

export const registerCheckInternalLinks = (server: McpServer): void => {
  server.registerTool('check-internal-links', {
    description: 'Analyze internal linking structure: anchor text diversity, link depth, and optimization suggestions',
    inputSchema: {
      url: z.string().describe('Full URL to analyze'),
      hostname: z.string().describe('Hostname with protocol for internal link detection'),
    },
  }, async ({ url, hostname }) => {
    const res = await fetch(url, { headers: DEFAULT_HEADERS });
    const html = await res.text();
    const dom = parseHTML(html);

    const links = extractLinks(dom, hostname);
    const internalLinks = links.internal;

    const issues: string[] = [];
    const suggestions: string[] = [];

    // Analyze anchor text
    const linksByAnchorText: Record<string, number> = {};
    const emptyAnchorLinks: string[] = [];
    const genericAnchorLinks: string[] = [];
    const genericTerms = ['click here', 'read more', 'learn more', 'here', 'link', 'more', 'this'];

    for (const link of internalLinks) {
      const anchorText = link.text.trim().toLowerCase();

      if (!anchorText) {
        emptyAnchorLinks.push(link.href);
      } else {
        linksByAnchorText[anchorText] = (linksByAnchorText[anchorText] || 0) + 1;

        if (genericTerms.includes(anchorText)) {
          genericAnchorLinks.push(link.href);
        }
      }
    }

    // Analyze link targets
    const linksByTarget: Record<string, number> = {};
    let nofollowLinks = 0;

    for (const link of internalLinks) {
      const target = link.target ?? 'self';
      linksByTarget[target] = (linksByTarget[target] || 0) + 1;

      if (link.rel?.includes('nofollow')) {
        nofollowLinks++;
      }
    }

    // Analyze link depth
    const linksByDepth: Record<number, number> = {};
    for (const link of internalLinks) {
      try {
        const parsed = new URL(link.href, hostname);
        const depth = parsed.pathname.split('/').filter(s => s.length > 0).length;
        linksByDepth[depth] = (linksByDepth[depth] || 0) + 1;
      } catch {
        // Relative URL, parse manually
        const depth = link.href.split('/').filter(s => s.length > 0).length;
        linksByDepth[depth] = (linksByDepth[depth] || 0) + 1;
      }
    }

    // Find most linked pages
    const linkCounts: Record<string, number> = {};
    for (const link of internalLinks) {
      const normalizedHref = normalizeUrl(link.href, hostname);
      linkCounts[normalizedHref] = (linkCounts[normalizedHref] || 0) + 1;
    }

    const topLinkedPages = Object.entries(linkCounts)
      .sort(([, a], [, b]) => b - a)
      .slice(0, 10)
      .map(([url, count]) => ({ url, count }));

    // Generate issues
    if (internalLinks.length < 3) {
      issues.push('Very few internal links. Add more to improve navigation and link equity distribution.');
    }

    if (emptyAnchorLinks.length > 0) {
      issues.push(`${emptyAnchorLinks.length} links have empty anchor text. Add descriptive text for accessibility and SEO.`);
    }

    if (genericAnchorLinks.length > 0) {
      issues.push(`${genericAnchorLinks.length} links use generic anchor text like "click here". Use descriptive, keyword-rich anchors.`);
    }

    if (nofollowLinks > 0) {
      issues.push(`${nofollowLinks} internal links have nofollow. Remove nofollow from internal links to pass PageRank.`);
    }

    // Generate suggestions
    const uniqueUrls = new Set(internalLinks.map(l => l.href));
    if (uniqueUrls.size < internalLinks.length * 0.5) {
      suggestions.push('Many duplicate internal links. Diversify to link to more pages.');
    }

    // Check anchor text diversity
    const uniqueAnchors = Object.keys(linksByAnchorText).length;
    if (uniqueAnchors < internalLinks.length * 0.3 && internalLinks.length > 10) {
      suggestions.push('Low anchor text diversity. Use varied, descriptive anchor text for different links.');
    }

    // Check for links opening in new tabs
    const newTabLinks = linksByTarget['_blank'] || 0;
    if (newTabLinks > internalLinks.length * 0.5) {
      suggestions.push('Many internal links open in new tabs. Keep users on your site by using same-tab navigation.');
    }

    // Deep links suggestion
    const deepLinks = Object.entries(linksByDepth)
      .filter(([depth]) => parseInt(depth) > 3)
      .reduce((sum, [, count]) => sum + count, 0);

    if (deepLinks === 0 && internalLinks.length > 5) {
      suggestions.push('Consider linking to deeper pages to distribute link equity throughout the site.');
    }

    const result: InternalLinkAnalysis = {
      url,
      hostname,
      totalInternalLinks: internalLinks.length,
      uniqueInternalLinks: uniqueUrls.size,
      analysis: {
        linksByAnchorText,
        linksByTarget,
        linksByDepth,
        nofollowLinks,
        emptyAnchorLinks: emptyAnchorLinks.length,
        genericAnchorLinks: genericAnchorLinks.length,
      },
      topLinkedPages,
      issues,
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

function normalizeUrl(href: string, hostname: string): string {
  try {
    const url = new URL(href, hostname);
    return url.pathname.replace(/\/$/, '') || '/';
  } catch {
    return href;
  }
}
