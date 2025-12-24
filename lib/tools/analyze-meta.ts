import { z } from 'zod/v3';
import { parse as parseHTML } from 'node-html-parser';
import type { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { DEFAULT_HEADERS } from '../config/mod';
import { extractMeta } from '../extraction/mod';
import { scoreTitleTag, scoreMetaDescription } from '../analysis/mod';
import { suggestTitleImprovements, suggestDescriptionImprovements } from '../suggestions/mod';

interface MetaAnalysisResult {
  url: string;
  title: {
    content: string | null;
    length: number;
    score: number;
    issues: string[];
    suggestions: string[];
    serpPreview: string;
  };
  description: {
    content: string | null;
    length: number;
    score: number;
    issues: string[];
    suggestions: string[];
    serpPreview: string;
  };
  openGraph: {
    hasRequiredTags: boolean;
    missing: string[];
    values: Record<string, string | null>;
  };
  twitter: {
    hasRequiredTags: boolean;
    missing: string[];
    values: Record<string, string | null>;
  };
  canonical: {
    value: string | null;
    matchesUrl: boolean;
    issues: string[];
  };
  robots: {
    value: string | null;
    isIndexable: boolean;
    isFollowable: boolean;
  };
  overallScore: number;
  priorityActions: string[];
}

export const registerAnalyzeMeta = (server: McpServer): void => {
  server.registerTool('analyze-meta', {
    description: 'Meta tag analysis with SERP preview, scores, and suggested improvements for title and description',
    inputSchema: {
      url: z.string().describe('Full URL to analyze'),
      targetKeyword: z.string().optional().describe('Target keyword for optimization'),
    },
  }, async ({ url, targetKeyword }) => {
    const res = await fetch(url, { headers: DEFAULT_HEADERS });
    const html = await res.text();
    const dom = parseHTML(html);

    const meta = extractMeta(dom);

    // Extract title
    const titleContent = typeof meta.title === 'string' ? meta.title : null;
    const titleScore = scoreTitleTag(titleContent, targetKeyword);
    const titleSuggestion = suggestTitleImprovements(titleContent, targetKeyword);

    // Extract description
    const descContent = typeof meta.description === 'string' ? meta.description : null;
    const descScore = scoreMetaDescription(descContent, targetKeyword);
    const descSuggestion = suggestDescriptionImprovements(descContent, targetKeyword, html);

    // Check Open Graph
    const ogMissing: string[] = [];
    const ogValues: Record<string, string | null> = {};

    const ogFields = ['title', 'description', 'image', 'url', 'type'] as const;
    for (const field of ogFields) {
      const value = meta.og[field];
      ogValues[field] = typeof value === 'string' ? value : null;
      if (typeof value !== 'string' && (field === 'title' || field === 'description')) {
        ogMissing.push(`og:${field}`);
      }
    }

    // Check Twitter Cards
    const twitterMissing: string[] = [];
    const twitterValues: Record<string, string | null> = {};

    const twitterFields = ['card', 'title', 'description', 'image'] as const;
    for (const field of twitterFields) {
      const value = meta.twitter[field];
      twitterValues[field] = typeof value === 'string' ? value : null;
      if (typeof value !== 'string' && field === 'card') {
        twitterMissing.push(`twitter:${field}`);
      }
    }

    // Check canonical
    const canonicalValue = typeof meta.canonical === 'string' ? meta.canonical : null;
    const canonicalIssues: string[] = [];
    if (!canonicalValue) {
      canonicalIssues.push('Missing canonical URL');
    } else if (canonicalValue !== url) {
      canonicalIssues.push(`Canonical URL differs from page URL`);
    }

    // Check robots
    const robotsValue = typeof meta.robots === 'string' ? meta.robots : null;
    const robotsLower = robotsValue?.toLowerCase() ?? '';
    const isIndexable = !robotsLower.includes('noindex');
    const isFollowable = !robotsLower.includes('nofollow');

    // Generate SERP previews
    const serpTitle = titleContent
      ? (titleContent.length > 60 ? titleContent.substring(0, 57) + '...' : titleContent)
      : 'No title';

    const serpDesc = descContent
      ? (descContent.length > 160 ? descContent.substring(0, 157) + '...' : descContent)
      : 'No description available for this page.';

    // Calculate overall score
    const overallScore = Math.round(
      (titleScore * 0.3) +
      (descScore * 0.3) +
      (ogMissing.length === 0 ? 20 : 10) +
      (twitterMissing.length === 0 ? 10 : 5) +
      (canonicalIssues.length === 0 ? 10 : 5)
    );

    // Priority actions
    const priorityActions: string[] = [];
    if (titleScore < 50) {
      priorityActions.push('Improve title tag - low score');
    }
    if (descScore < 50) {
      priorityActions.push('Improve meta description - low score');
    }
    if (ogMissing.length > 0) {
      priorityActions.push(`Add missing Open Graph tags: ${ogMissing.join(', ')}`);
    }
    if (!canonicalValue) {
      priorityActions.push('Add canonical URL');
    }
    if (!isIndexable) {
      priorityActions.push('Page is noindexed - remove if this is unintentional');
    }

    const result: MetaAnalysisResult = {
      url,
      title: {
        content: titleContent,
        length: titleContent?.length ?? 0,
        score: titleScore,
        issues: titleSuggestion.issues,
        suggestions: [...titleSuggestion.suggestions, ...titleSuggestion.recommendations],
        serpPreview: serpTitle,
      },
      description: {
        content: descContent,
        length: descContent?.length ?? 0,
        score: descScore,
        issues: descSuggestion.issues,
        suggestions: [...descSuggestion.suggestions, ...descSuggestion.recommendations],
        serpPreview: serpDesc,
      },
      openGraph: {
        hasRequiredTags: ogMissing.length === 0,
        missing: ogMissing,
        values: ogValues,
      },
      twitter: {
        hasRequiredTags: twitterMissing.length === 0,
        missing: twitterMissing,
        values: twitterValues,
      },
      canonical: {
        value: canonicalValue,
        matchesUrl: canonicalValue === url,
        issues: canonicalIssues,
      },
      robots: {
        value: robotsValue,
        isIndexable,
        isFollowable,
      },
      overallScore,
      priorityActions,
    };

    return {
      content: [{
        type: 'text',
        text: JSON.stringify(result, null, 2),
      }],
    };
  });
};
