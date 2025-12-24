import { z } from 'zod/v3';
import { parse as parseHTML } from 'node-html-parser';
import type { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { DEFAULT_HEADERS } from '../config/mod';
import { extractHeadingData } from '../extraction/mod';
import { suggestHeadingImprovements } from '../suggestions/mod';
import type { HeadingContent } from '../suggestions/mod';

interface HeadingAnalysisResult {
  url: string;
  structure: {
    h1Count: number;
    h2Count: number;
    h3Count: number;
    h4Count: number;
    h5Count: number;
    h6Count: number;
    totalHeadings: number;
    hasProperHierarchy: boolean;
  };
  headings: {
    h1: string[];
    h2: string[];
    h3: string[];
    h4: string[];
    h5: string[];
    h6: string[];
  };
  outline: string[];
  keywordPresence: {
    inH1: boolean;
    inH2: boolean;
    inAny: boolean;
  };
  issues: string[];
  suggestions: string[];
  score: number;
}

export const registerAnalyzeHeadings = (server: McpServer): void => {
  server.registerTool('analyze-headings', {
    description: 'Heading structure analysis with hierarchy validation, keyword checking, and improvement suggestions',
    inputSchema: {
      url: z.string().describe('Full URL to analyze'),
      targetKeyword: z.string().optional().describe('Target keyword to check presence'),
    },
  }, async ({ url, targetKeyword }) => {
    const res = await fetch(url, { headers: DEFAULT_HEADERS });
    const html = await res.text();
    const dom = parseHTML(html);

    // Extract all headings
    const headings: HeadingContent = {
      h1: extractHeadingData(dom, 'h1'),
      h2: extractHeadingData(dom, 'h2'),
      h3: extractHeadingData(dom, 'h3'),
      h4: extractHeadingData(dom, 'h4'),
      h5: extractHeadingData(dom, 'h5'),
      h6: extractHeadingData(dom, 'h6'),
    };

    const suggestion = suggestHeadingImprovements(headings, targetKeyword);

    // Generate document outline
    const outline: string[] = [];
    const allHeadings = dom.querySelectorAll('h1, h2, h3, h4, h5, h6');

    for (const heading of allHeadings) {
      const level = parseInt(heading.tagName.substring(1));
      const indent = '  '.repeat(level - 1);
      const text = heading.textContent.trim();
      if (text) {
        outline.push(`${indent}${heading.tagName}: ${text}`);
      }
    }

    // Check keyword presence
    const keywordLower = targetKeyword?.toLowerCase() ?? '';
    const inH1 = keywordLower ? headings.h1.texts.some(t => t.toLowerCase().includes(keywordLower)) : false;
    const inH2 = keywordLower ? headings.h2.texts.some(t => t.toLowerCase().includes(keywordLower)) : false;
    const inAny = keywordLower ? [
      ...headings.h1.texts,
      ...headings.h2.texts,
      ...headings.h3.texts,
    ].some(t => t.toLowerCase().includes(keywordLower)) : false;

    // Calculate score
    let score = 0;

    // H1 scoring (30 points)
    if (suggestion.structure.h1Count === 1) {
      score += 30;
    } else if (suggestion.structure.h1Count > 0) {
      score += 10;
    }

    // Hierarchy scoring (25 points)
    if (suggestion.structure.hasProperHierarchy) {
      score += 25;
    } else if (suggestion.structure.skippedLevels.length <= 1) {
      score += 15;
    }

    // Content structure (20 points)
    if (suggestion.structure.h2Count >= 2) {
      score += 20;
    } else if (suggestion.structure.h2Count >= 1) {
      score += 10;
    }

    // Keyword presence (15 points)
    if (targetKeyword) {
      if (inH1) score += 10;
      if (inH2) score += 5;
    } else {
      score += 10; // Default if no keyword
    }

    // Overall structure (10 points)
    if (suggestion.structure.totalHeadings >= 3) {
      score += 10;
    } else if (suggestion.structure.totalHeadings >= 1) {
      score += 5;
    }

    const result: HeadingAnalysisResult = {
      url,
      structure: {
        h1Count: suggestion.structure.h1Count,
        h2Count: suggestion.structure.h2Count,
        h3Count: suggestion.structure.h3Count,
        h4Count: suggestion.structure.h4Count,
        h5Count: suggestion.structure.h5Count,
        h6Count: suggestion.structure.h6Count,
        totalHeadings: suggestion.structure.totalHeadings,
        hasProperHierarchy: suggestion.structure.hasProperHierarchy,
      },
      headings: {
        h1: headings.h1.texts,
        h2: headings.h2.texts,
        h3: headings.h3.texts,
        h4: headings.h4.texts,
        h5: headings.h5.texts,
        h6: headings.h6.texts,
      },
      outline,
      keywordPresence: {
        inH1,
        inH2,
        inAny,
      },
      issues: suggestion.issues,
      suggestions: suggestion.recommendations,
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
