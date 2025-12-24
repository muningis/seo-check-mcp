import { z } from 'zod/v3';
import { parse as parseHTML } from 'node-html-parser';
import type { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { DEFAULT_HEADERS } from '../config/mod';
import { analyzeUrl } from '../suggestions/mod';
import { extractMeta } from '../extraction/mod';

interface UrlAnalysisResult {
  url: string;
  structure: {
    protocol: string;
    hostname: string;
    pathname: string;
    search: string;
    depth: number;
    hasTrailingSlash: boolean;
    hasWww: boolean;
    isHttps: boolean;
    segments: string[];
  };
  canonical: {
    value: string | null;
    matchesUrl: boolean;
    issues: string[];
  };
  urlLength: number;
  readability: {
    score: number;
    interpretation: string;
  };
  issues: string[];
  suggestions: string[];
  score: number;
}

export const registerAnalyzeUrl = (server: McpServer): void => {
  server.registerTool('analyze-url', {
    description: 'URL structure analysis with length, readability, canonical validation, and SEO recommendations',
    inputSchema: {
      url: z.string().describe('Full URL to analyze'),
      targetKeyword: z.string().optional().describe('Target keyword to check presence in URL'),
    },
  }, async ({ url, targetKeyword }) => {
    // Fetch page to get canonical
    const res = await fetch(url, { headers: DEFAULT_HEADERS });
    const html = await res.text();
    const dom = parseHTML(html);
    const meta = extractMeta(dom);

    const canonicalValue = typeof meta.canonical === 'string' ? meta.canonical : null;

    // Analyze URL structure
    const analysis = analyzeUrl(url, canonicalValue, targetKeyword);

    // Calculate readability score
    let readabilityScore = 100;
    let readabilityInterpretation = 'Excellent';

    // Deduct for issues
    if (!analysis.structure.isHttps) readabilityScore -= 20;
    if (analysis.structure.depth > 4) readabilityScore -= 15;
    if (url.length > 100) readabilityScore -= 15;
    if (analysis.structure.pathname.includes('_')) readabilityScore -= 10;
    if (analysis.structure.pathname.match(/[A-Z]/)) readabilityScore -= 5;
    if (analysis.structure.search.length > 0) readabilityScore -= 10;

    // Add for good practices
    if (analysis.structure.segments.every(s => s.length <= 20)) readabilityScore = Math.min(100, readabilityScore + 5);

    // Interpret score
    if (readabilityScore >= 90) {
      readabilityInterpretation = 'Excellent - URL is clean and SEO-friendly';
    } else if (readabilityScore >= 70) {
      readabilityInterpretation = 'Good - Minor improvements possible';
    } else if (readabilityScore >= 50) {
      readabilityInterpretation = 'Fair - Several issues to address';
    } else {
      readabilityInterpretation = 'Poor - Needs significant improvement';
    }

    // Canonical issues
    const canonicalIssues: string[] = [];
    if (!canonicalValue) {
      canonicalIssues.push('Missing canonical URL - add one to prevent duplicate content');
    } else if (canonicalValue !== url) {
      canonicalIssues.push('Canonical URL differs from current URL');

      // Check if only trailing slash differs
      const normalizedUrl = url.replace(/\/$/, '');
      const normalizedCanonical = canonicalValue.replace(/\/$/, '');
      if (normalizedUrl === normalizedCanonical) {
        canonicalIssues.push('Difference is only trailing slash - ensure consistency');
      }
    }

    // Calculate overall score
    let score = 0;

    // HTTPS (20 points)
    if (analysis.structure.isHttps) score += 20;

    // URL length (20 points)
    if (url.length <= 75) score += 20;
    else if (url.length <= 100) score += 15;
    else if (url.length <= 150) score += 10;

    // Depth (20 points)
    if (analysis.structure.depth <= 3) score += 20;
    else if (analysis.structure.depth <= 4) score += 15;
    else if (analysis.structure.depth <= 5) score += 10;

    // Canonical (20 points)
    if (canonicalValue === url) score += 20;
    else if (canonicalValue) score += 10;

    // Clean URL (20 points)
    let cleanUrlScore = 20;
    if (analysis.structure.search.length > 0) cleanUrlScore -= 5;
    if (analysis.structure.pathname.includes('_')) cleanUrlScore -= 5;
    if (analysis.structure.pathname.match(/[A-Z]/)) cleanUrlScore -= 5;
    if (analysis.structure.pathname.match(/%[0-9A-F]/i)) cleanUrlScore -= 5;
    score += Math.max(0, cleanUrlScore);

    const result: UrlAnalysisResult = {
      url,
      structure: analysis.structure,
      canonical: {
        value: canonicalValue,
        matchesUrl: canonicalValue === url,
        issues: canonicalIssues,
      },
      urlLength: url.length,
      readability: {
        score: readabilityScore,
        interpretation: readabilityInterpretation,
      },
      issues: analysis.issues,
      suggestions: analysis.recommendations,
      score,
    };

    return {
      content: [{
        type: 'text',
        text: JSON.stringify(result, null, 2),
      }],
    };
  });
};
