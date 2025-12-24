import { z } from 'zod/v3';
import { parse as parseHTML } from 'node-html-parser';
import type { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { DEFAULT_HEADERS } from '../config/mod';
import {
  extractWords,
  countSentences,
  averageSentenceLength,
  averageSyllablesPerWord,
  countComplexWords,
  extractParagraphs,
  calculateReadabilityScores,
} from '../analysis/mod';

export interface ReadabilityResult {
  url: string;
  scores: {
    fleschReadingEase: number;
    fleschKincaidGrade: number;
    gunningFog: number;
    smogIndex: number;
    automatedReadabilityIndex: number;
  };
  interpretation: string;
  statistics: {
    wordCount: number;
    sentenceCount: number;
    paragraphCount: number;
    avgSentenceLength: number;
    avgSyllablesPerWord: number;
    complexWordCount: number;
    complexWordPercentage: number;
  };
  gradeComparison: {
    score: string;
    targetAudience: string;
    recommendation: string;
  };
  suggestions: string[];
}

export const registerCheckReadability = (server: McpServer): void => {
  // @ts-ignore - Deep type instantiation with Zod/MCP SDK
  server.registerTool('check-readability', {
    description: 'Focused readability analysis with Flesch-Kincaid, Gunning Fog, SMOG scores and detailed suggestions',
    inputSchema: {
      url: z.string().describe('Full URL to analyze'),
      targetGrade: z.number().optional().describe('Target grade level (default: 8 for web content)'),
    },
  }, async ({ url, targetGrade = 8 }) => {
    const res = await fetch(url, { headers: DEFAULT_HEADERS });
    const html = await res.text();
    const dom = parseHTML(html);

    // Extract text content
    const body = dom.querySelector('body');
    const scripts = body?.querySelectorAll('script, style, noscript') ?? [];
    scripts.forEach(el => el.remove());

    const textContent = body?.textContent ?? '';
    const words = extractWords(textContent);
    const wordCount = words.length;
    const sentenceCount = countSentences(textContent);
    const paragraphs = extractParagraphs(textContent);
    const complexWords = countComplexWords(textContent);

    const scores = calculateReadabilityScores(textContent);
    const avgSentenceLen = averageSentenceLength(textContent);
    const avgSyllables = averageSyllablesPerWord(textContent);

    // Determine grade comparison
    let gradeComparison: ReadabilityResult['gradeComparison'];
    const actualGrade = scores.fleschKincaidGrade;

    if (actualGrade <= targetGrade) {
      gradeComparison = {
        score: 'Excellent',
        targetAudience: `Suitable for grade ${Math.round(actualGrade)} and above`,
        recommendation: 'Content is appropriately readable for web audiences',
      };
    } else if (actualGrade <= targetGrade + 2) {
      gradeComparison = {
        score: 'Good',
        targetAudience: `Requires grade ${Math.round(actualGrade)} education`,
        recommendation: 'Minor simplification could improve accessibility',
      };
    } else {
      gradeComparison = {
        score: 'Needs Improvement',
        targetAudience: `Requires grade ${Math.round(actualGrade)} education`,
        recommendation: `Simplify to reach target grade ${targetGrade} level`,
      };
    }

    // Generate suggestions
    const suggestions: string[] = [];

    if (avgSentenceLen > 20) {
      suggestions.push(`Break up long sentences. Current average: ${Math.round(avgSentenceLen)} words. Target: 15-20 words.`);
    }

    if (avgSyllables > 1.5) {
      suggestions.push(`Use simpler words. Average syllables per word: ${avgSyllables.toFixed(2)}. Use more one and two-syllable words.`);
    }

    const complexPercentage = (complexWords / wordCount) * 100;
    if (complexPercentage > 10) {
      suggestions.push(`Reduce complex words (3+ syllables). Currently ${complexPercentage.toFixed(1)}% of content. Target: under 10%.`);
    }

    if (scores.fleschReadingEase < 60) {
      suggestions.push(`Flesch Reading Ease is ${scores.fleschReadingEase}. Aim for 60-70 for web content.`);
    }

    if (scores.gunningFog > 12) {
      suggestions.push(`Gunning Fog Index is ${scores.gunningFog}. Reduce jargon and technical terms.`);
    }

    // Paragraph length suggestions
    const longParagraphs = paragraphs.filter(p => extractWords(p).length > 100);
    if (longParagraphs.length > 0) {
      suggestions.push(`${longParagraphs.length} paragraph(s) exceed 100 words. Break them into smaller chunks.`);
    }

    // Actionable improvements
    if (suggestions.length === 0) {
      suggestions.push('Content readability is excellent. No immediate improvements needed.');
    }

    const result: ReadabilityResult = {
      url,
      scores: {
        fleschReadingEase: scores.fleschReadingEase,
        fleschKincaidGrade: scores.fleschKincaidGrade,
        gunningFog: scores.gunningFog,
        smogIndex: scores.smogIndex,
        automatedReadabilityIndex: scores.automatedReadabilityIndex,
      },
      interpretation: scores.interpretation,
      statistics: {
        wordCount,
        sentenceCount,
        paragraphCount: paragraphs.length,
        avgSentenceLength: Math.round(avgSentenceLen * 10) / 10,
        avgSyllablesPerWord: Math.round(avgSyllables * 100) / 100,
        complexWordCount: complexWords,
        complexWordPercentage: Math.round(complexPercentage * 10) / 10,
      },
      gradeComparison,
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
