import { z } from 'zod/v3';
import { parse as parseHTML } from 'node-html-parser';
import type { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { DEFAULT_HEADERS } from '../config/mod';
import {
  extractWords,
  extractKeywords,
  calculateKeywordDensity,
  generateTextFingerprint,
  countSentences,
  averageSentenceLength,
  calculateReadabilityScores,
  scoreContentLength,
} from '../analysis/mod';

export interface ContentAnalysisResult {
  url: string;
  wordCount: number;
  sentenceCount: number;
  avgSentenceLength: number;
  readability: {
    fleschReadingEase: number;
    fleschKincaidGrade: number;
    gunningFog: number;
    smogIndex: number;
    automatedReadabilityIndex: number;
    interpretation: string;
  };
  keywords: {
    topKeywords: Array<{ word: string; count: number; density: number }>;
    targetKeywordDensity: number | null;
  };
  contentScore: number;
  fingerprint: string;
  suggestions: string[];
}

export const registerAnalyzeContent = (server: McpServer): void => {
  server.registerTool('analyze-content', {
    description: 'Analyze page content for SEO: keyword density, readability scores (Flesch-Kincaid, SMOG, Gunning Fog), content length, and actionable suggestions',
    inputSchema: {
      url: z.string().describe('Full URL to analyze'),
      targetKeyword: z.string().optional().describe('Target keyword to check density for'),
    },
  }, async ({ url, targetKeyword }) => {
    const res = await fetch(url, { headers: DEFAULT_HEADERS });
    const html = await res.text();
    const dom = parseHTML(html);

    // Extract text content from body
    const body = dom.querySelector('body');
    const scripts = body?.querySelectorAll('script, style, noscript') ?? [];
    scripts.forEach(el => el.remove());

    const textContent = body?.textContent ?? '';
    const words = extractWords(textContent);
    const wordCount = words.length;
    const sentenceCount = countSentences(textContent);

    // Calculate metrics
    const readability = calculateReadabilityScores(textContent);
    const avgSentenceLen = averageSentenceLength(textContent);
    const contentScore = scoreContentLength(wordCount);
    const fingerprint = generateTextFingerprint(textContent);

    // Keywords analysis
    const keywordMap = extractKeywords(textContent);
    const topKeywords = Array.from(keywordMap.entries())
      .slice(0, 10)
      .map(([word, count]) => ({
        word,
        count,
        density: Math.round(calculateKeywordDensity(textContent, word) * 100) / 100,
      }));

    let targetKeywordDensity: number | null = null;
    if (targetKeyword) {
      targetKeywordDensity = Math.round(calculateKeywordDensity(textContent, targetKeyword) * 100) / 100;
    }

    // Generate suggestions
    const suggestions: string[] = [];

    if (wordCount < 300) {
      suggestions.push(`Content is thin (${wordCount} words). Aim for at least 500-1000 words for better rankings.`);
    } else if (wordCount < 600) {
      suggestions.push(`Content could be expanded (${wordCount} words). Consider adding more depth.`);
    }

    if (readability.fleschReadingEase < 50) {
      suggestions.push(`Content is difficult to read (Flesch score: ${readability.fleschReadingEase}). Simplify sentences and use shorter words.`);
    }

    if (avgSentenceLen > 25) {
      suggestions.push(`Average sentence length is high (${Math.round(avgSentenceLen)} words). Break up long sentences.`);
    }

    if (targetKeyword && targetKeywordDensity !== null) {
      if (targetKeywordDensity < 0.5) {
        suggestions.push(`Target keyword "${targetKeyword}" density is low (${targetKeywordDensity}%). Consider using it more naturally.`);
      } else if (targetKeywordDensity > 3) {
        suggestions.push(`Target keyword "${targetKeyword}" may be over-optimized (${targetKeywordDensity}%). Reduce usage to avoid keyword stuffing.`);
      }
    }

    if (readability.fleschKincaidGrade > 12) {
      suggestions.push(`Content reads at college level (grade ${readability.fleschKincaidGrade}). Consider simplifying for broader audience.`);
    }

    const result: ContentAnalysisResult = {
      url,
      wordCount,
      sentenceCount,
      avgSentenceLength: Math.round(avgSentenceLen * 10) / 10,
      readability,
      keywords: {
        topKeywords,
        targetKeywordDensity,
      },
      contentScore,
      fingerprint,
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
