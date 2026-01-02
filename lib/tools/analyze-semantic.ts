import { z } from 'zod/v3';
import { parse as parseHTML } from 'node-html-parser';
import type { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { DEFAULT_HEADERS } from '../config/mod';
import {
  extractLandmarks,
  extractAriaInfo,
  extractAccessibilityIssues,
} from '../extraction/mod';
import {
  analyzeSemanticStructure,
  calculateSemanticScore,
} from '../suggestions/mod';
import type { SemanticAnalysisResult } from '../types/mod';

export const registerAnalyzeSemantic = (server: McpServer): void => {
  server.registerTool('analyze-semantic', {
    description: 'Semantic HTML and ARIA accessibility analysis with WCAG 2.1 Level A compliance checks',
    inputSchema: {
      url: z.string().describe('Full URL to analyze'),
    },
  }, async ({ url }) => {
    const res = await fetch(url, { headers: DEFAULT_HEADERS });
    const html = await res.text();
    const dom = parseHTML(html);

    // Extract semantic information
    const landmarks = extractLandmarks(dom);
    const aria = extractAriaInfo(dom);
    const accessibilityIssues = extractAccessibilityIssues(dom);

    // Analyze and generate suggestions
    const analysis = analyzeSemanticStructure(landmarks, aria, accessibilityIssues);
    const score = calculateSemanticScore(landmarks, aria, accessibilityIssues);

    const result: SemanticAnalysisResult = {
      url,
      landmarks,
      aria,
      accessibilityIssues,
      score,
      issues: analysis.issues,
      suggestions: analysis.suggestions,
      passedChecks: analysis.passedChecks,
    };

    return {
      content: [{
        type: 'text',
        text: JSON.stringify(result, null, 2),
      }],
    };
  });
};
