import { z } from 'zod/v3';
import { parse as parseHTML } from 'node-html-parser';
import type { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { DEFAULT_HEADERS } from '../config/mod';
import { extractHeadingData } from '../extraction/mod';
import { suggestHeadingImprovements } from '../suggestions/mod';
import type { HeadingContent } from '../suggestions/mod';
import type { ActionableInstruction, FixResult } from '../types/mod';

export const registerFixHeadings = (server: McpServer): void => {
  server.registerTool('fix-headings', {
    description: 'Returns actionable instructions for heading structure fixes (H1-H6 hierarchy)',
    inputSchema: {
      url: z.string().describe('Full URL to analyze'),
      targetKeyword: z.string().optional().describe('Target keyword for optimization'),
    },
  }, async ({ url, targetKeyword }) => {
    const res = await fetch(url, { headers: DEFAULT_HEADERS });
    const html = await res.text();
    const dom = parseHTML(html);

    const headings: HeadingContent = {
      h1: extractHeadingData(dom, 'h1'),
      h2: extractHeadingData(dom, 'h2'),
      h3: extractHeadingData(dom, 'h3'),
      h4: extractHeadingData(dom, 'h4'),
      h5: extractHeadingData(dom, 'h5'),
      h6: extractHeadingData(dom, 'h6'),
    };

    const suggestion = suggestHeadingImprovements(headings, targetKeyword);
    const instructions: ActionableInstruction[] = [];

    // Missing H1
    if (suggestion.structure.h1Count === 0) {
      // Check if there's an H2 that could be promoted
      if (headings.h2.texts.length > 0) {
        const firstH2 = headings.h2.texts[0];
        instructions.push({
          action: 'replace',
          target: { type: 'html-tag', selector: 'h2:first-of-type' },
          value: {
            current: `<h2>${firstH2}</h2>`,
            suggested: `<h1>${firstH2}</h1>`,
          },
          reason: 'Page missing H1. Promoting first H2 to H1. Every page needs exactly one H1 for SEO.',
          priority: 'critical',
          automated: false,
        });
      } else {
        instructions.push({
          action: 'add',
          target: { type: 'html-tag', selector: 'main, article, body', tagName: 'h1' },
          value: {
            suggested: targetKeyword
              ? `<h1>${targetKeyword} - Main Page Topic</h1>`
              : '<h1>Main Page Heading</h1>',
          },
          reason: 'Missing H1 tag - critical for SEO. Add a descriptive H1 as the first heading on the page.',
          priority: 'critical',
          automated: false,
        });
      }
    }

    // Multiple H1s
    if (suggestion.structure.h1Count > 1) {
      const h1Texts = headings.h1.texts;
      // Keep the first H1, demote others
      for (let i = 1; i < h1Texts.length; i++) {
        instructions.push({
          action: 'replace',
          target: { type: 'html-tag', selector: `h1:nth-of-type(${i + 1})` },
          value: {
            current: `<h1>${h1Texts[i]}</h1>`,
            suggested: `<h2>${h1Texts[i]}</h2>`,
          },
          reason: `Multiple H1 tags found (${suggestion.structure.h1Count}). Demote extra H1s to H2 for proper hierarchy.`,
          priority: 'high',
          automated: true,
        });
      }
    }

    // Skipped heading levels
    if (suggestion.structure.skippedLevels.length > 0) {
      instructions.push({
        action: 'update',
        target: { type: 'content' },
        value: {
          current: `Skipped levels: H${suggestion.structure.skippedLevels.join(', H')}`,
          suggested: 'Restructure headings to follow proper hierarchy: H1 → H2 → H3 → H4 → H5 → H6',
        },
        reason: 'Skipping heading levels hurts accessibility and SEO. Screen readers use heading hierarchy for navigation.',
        priority: 'medium',
        automated: false,
      });
    }

    // H1 too long
    for (const h1Text of headings.h1.texts) {
      if (h1Text.length > 70) {
        instructions.push({
          action: 'update',
          target: {
            type: 'html-tag',
            selector: 'h1',
          },
          value: {
            current: `<h1>${h1Text}</h1>`,
            suggested: `<h1>${h1Text.substring(0, 65)}...</h1>`,
          },
          reason: `H1 too long (${h1Text.length} chars). Keep under 70 characters for optimal SEO display.`,
          priority: 'low',
          automated: false,
        });
      }

      if (h1Text.length < 20 && h1Text.length > 0) {
        instructions.push({
          action: 'update',
          target: {
            type: 'html-tag',
            selector: 'h1',
          },
          value: {
            current: `<h1>${h1Text}</h1>`,
            suggested: targetKeyword
              ? `<h1>${h1Text} - ${targetKeyword}</h1>`
              : `<h1>${h1Text} - Additional Descriptive Text</h1>`,
          },
          reason: `H1 too short (${h1Text.length} chars). Make it more descriptive to improve SEO.`,
          priority: 'medium',
          automated: false,
        });
      }
    }

    // Keyword in H1
    if (targetKeyword && suggestion.structure.h1Count > 0) {
      const h1ContainsKeyword = headings.h1.texts.some(
        t => t.toLowerCase().includes(targetKeyword.toLowerCase())
      );

      if (!h1ContainsKeyword) {
        const currentH1 = headings.h1.texts[0];
        instructions.push({
          action: 'update',
          target: {
            type: 'html-tag',
            selector: 'h1',
          },
          value: {
            current: `<h1>${currentH1}</h1>`,
            suggested: `<h1>${targetKeyword}: ${currentH1}</h1>`,
          },
          reason: `Target keyword "${targetKeyword}" not found in H1. Including keywords in H1 improves SEO.`,
          priority: 'medium',
          automated: false,
        });
      }
    }

    // Missing H2s for content structure
    if (suggestion.structure.h2Count === 0 && suggestion.structure.totalHeadings > 0) {
      instructions.push({
        action: 'add',
        target: { type: 'html-tag', selector: 'main, article, body', tagName: 'h2' },
        value: {
          suggested: '<h2>Section Heading</h2>',
        },
        reason: 'No H2 headings found. Use H2s to divide content into logical sections.',
        priority: 'medium',
        automated: false,
      });
    }

    // Too few headings overall
    if (suggestion.structure.totalHeadings < 3) {
      instructions.push({
        action: 'add',
        target: { type: 'content' },
        value: {
          suggested: 'Add more H2 and H3 headings throughout the content',
        },
        reason: `Only ${suggestion.structure.totalHeadings} heading(s) found. More headings improve readability and SEO.`,
        priority: 'low',
        automated: false,
      });
    }

    // Summary
    const criticalCount = instructions.filter(i => i.priority === 'critical').length;
    const highCount = instructions.filter(i => i.priority === 'high').length;
    const mediumCount = instructions.filter(i => i.priority === 'medium').length;
    const lowCount = instructions.filter(i => i.priority === 'low').length;

    const summaryParts = [];
    if (criticalCount) summaryParts.push(`${criticalCount} critical`);
    if (highCount) summaryParts.push(`${highCount} high`);
    if (mediumCount) summaryParts.push(`${mediumCount} medium`);
    if (lowCount) summaryParts.push(`${lowCount} low`);

    const result: FixResult = {
      url,
      instructions,
      summary: summaryParts.length > 0
        ? `${instructions.length} fixes needed: ${summaryParts.join(', ')} priority`
        : 'No heading structure issues found',
    };

    return {
      content: [{
        type: 'text',
        text: JSON.stringify(result, null, 2),
      }],
    };
  });
};
