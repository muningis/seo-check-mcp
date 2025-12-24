import { z } from 'zod/v3';
import { XMLParser } from 'fast-xml-parser';
import type { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { DEFAULT_HEADERS } from '../config/mod';

interface SitemapUrl {
  loc: string;
  lastmod?: string;
  changefreq?: string;
  priority?: number;
}

interface SitemapAnalysisResult {
  hostname: string;
  sitemapUrl: string;
  isIndex: boolean;
  urlCount: number;
  childSitemaps: string[];
  analysis: {
    urlsByChangefreq: Record<string, number>;
    urlsByPriority: Record<string, number>;
    lastmodStats: {
      hasLastmod: number;
      missingLastmod: number;
      oldestUrl: string | null;
      newestUrl: string | null;
      staleUrls: number; // > 1 year old
    };
    urlDepthDistribution: Record<number, number>;
  };
  issues: string[];
  suggestions: string[];
  sampleUrls: SitemapUrl[];
}

const xmlParser = new XMLParser();

export const registerAnalyzeSitemap = (server: McpServer): void => {
  server.registerTool('analyze-sitemap', {
    description: 'Deep sitemap analysis: URL coverage, freshness, priority distribution, and optimization suggestions',
    inputSchema: {
      hostname: z.string().describe('Hostname with protocol, e.g. https://example.org'),
      sitemapPath: z.string().optional().describe('Custom sitemap path (default: /sitemap.xml)'),
    },
  }, async ({ hostname, sitemapPath = '/sitemap.xml' }) => {
    const sitemapUrl = `${hostname}${sitemapPath}`;
    const res = await fetch(sitemapUrl, { headers: DEFAULT_HEADERS });
    const xml = await res.text();
    const data = xmlParser.parse(xml);

    const issues: string[] = [];
    const suggestions: string[] = [];

    // Check if it's a sitemap index
    const isIndex = 'sitemapindex' in data;
    let urls: SitemapUrl[] = [];
    let childSitemaps: string[] = [];

    if (isIndex) {
      const sitemaps = data.sitemapindex?.sitemap;
      childSitemaps = (Array.isArray(sitemaps) ? sitemaps : [sitemaps])
        .filter(Boolean)
        .map((s: { loc: string }) => s.loc);

      suggestions.push(`Sitemap index found with ${childSitemaps.length} child sitemaps. Consider analyzing each individually.`);
    } else {
      const urlset = data.urlset?.url;
      urls = (Array.isArray(urlset) ? urlset : [urlset]).filter(Boolean) as SitemapUrl[];
    }

    // Analyze URLs
    const urlsByChangefreq: Record<string, number> = {};
    const urlsByPriority: Record<string, number> = {};
    const urlDepthDistribution: Record<number, number> = {};

    let hasLastmod = 0;
    let missingLastmod = 0;
    let oldestDate: Date | null = null;
    let newestDate: Date | null = null;
    let oldestUrl: string | null = null;
    let newestUrl: string | null = null;
    let staleUrls = 0;
    const oneYearAgo = new Date();
    oneYearAgo.setFullYear(oneYearAgo.getFullYear() - 1);

    for (const url of urls) {
      // Changefreq distribution
      const freq = url.changefreq ?? 'not specified';
      urlsByChangefreq[freq] = (urlsByChangefreq[freq] || 0) + 1;

      // Priority distribution
      const priority = url.priority?.toString() ?? 'not specified';
      urlsByPriority[priority] = (urlsByPriority[priority] || 0) + 1;

      // URL depth
      try {
        const parsed = new URL(url.loc);
        const depth = parsed.pathname.split('/').filter(s => s.length > 0).length;
        urlDepthDistribution[depth] = (urlDepthDistribution[depth] || 0) + 1;
      } catch {
        // Invalid URL
      }

      // Lastmod analysis
      if (url.lastmod) {
        hasLastmod++;
        try {
          const date = new Date(url.lastmod);
          if (!oldestDate || date < oldestDate) {
            oldestDate = date;
            oldestUrl = url.loc;
          }
          if (!newestDate || date > newestDate) {
            newestDate = date;
            newestUrl = url.loc;
          }
          if (date < oneYearAgo) {
            staleUrls++;
          }
        } catch {
          // Invalid date
        }
      } else {
        missingLastmod++;
      }
    }

    // Generate issues and suggestions
    if (urls.length === 0 && !isIndex) {
      issues.push('Sitemap is empty - no URLs found');
    }

    if (urls.length > 50000) {
      issues.push(`Sitemap exceeds 50,000 URL limit (${urls.length} URLs). Split into multiple sitemaps.`);
    }

    if (missingLastmod > 0 && urls.length > 0) {
      const percentage = Math.round((missingLastmod / urls.length) * 100);
      if (percentage > 50) {
        issues.push(`${percentage}% of URLs missing lastmod dates`);
        suggestions.push('Add lastmod dates to help search engines prioritize crawling');
      }
    }

    if (staleUrls > 0 && urls.length > 0) {
      const percentage = Math.round((staleUrls / urls.length) * 100);
      if (percentage > 30) {
        suggestions.push(`${percentage}% of URLs haven't been updated in over a year. Review for freshness.`);
      }
    }

    // Check priority usage
    const defaultPriorityCount = urlsByPriority['0.5'] || 0;
    if (defaultPriorityCount === urls.length && urls.length > 0) {
      suggestions.push('All URLs have default priority (0.5). Use varied priorities to indicate page importance.');
    }

    // Check changefreq usage
    if (urlsByChangefreq['not specified'] === urls.length && urls.length > 0) {
      suggestions.push('No changefreq specified. Add changefreq hints for crawl optimization.');
    }

    // Check for deep URLs
    const deepUrls = Object.entries(urlDepthDistribution)
      .filter(([depth]) => parseInt(depth) > 4)
      .reduce((sum, [, count]) => sum + count, 0);

    if (deepUrls > 0 && urls.length > 0) {
      const percentage = Math.round((deepUrls / urls.length) * 100);
      if (percentage > 20) {
        suggestions.push(`${percentage}% of URLs are more than 4 levels deep. Consider flattening site structure.`);
      }
    }

    const result: SitemapAnalysisResult = {
      hostname,
      sitemapUrl,
      isIndex,
      urlCount: urls.length,
      childSitemaps,
      analysis: {
        urlsByChangefreq,
        urlsByPriority,
        lastmodStats: {
          hasLastmod,
          missingLastmod,
          oldestUrl,
          newestUrl,
          staleUrls,
        },
        urlDepthDistribution,
      },
      issues,
      suggestions,
      sampleUrls: urls.slice(0, 10),
    };

    return {
      content: [{
        type: 'text',
        text: JSON.stringify(result, null, 2),
      }],
    };
  });
};
