import { z } from 'zod/v3';
import { readFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import type { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import {
  analyzeMarkdownContent,
  generateContentInstructions,
  calculateCategoryScores,
} from '../analysis/mod';
import type { ContentFixResult, ContentAnalysisOptions } from '../types/content-instructions';

export const registerImproveContent = (server: McpServer): void => {
  server.registerTool('improve-content', {
    description: 'Analyzes local markdown files and returns actionable instructions for improving SEO, readability, and structure',
    inputSchema: {
      filePath: z.string().describe('Local file path to the markdown file (e.g., "./content/blog-post.md")'),
      targetKeyword: z.string().optional().describe('Target keyword for SEO optimization'),
      targetAudience: z.string().optional().describe('Target audience: "general", "technical", or "beginner"'),
    },
  }, async ({ filePath, targetKeyword, targetAudience: targetAudienceRaw }) => {
    // Validate targetAudience
    const validAudiences = ['general', 'technical', 'beginner'] as const;
    const targetAudience = validAudiences.includes(targetAudienceRaw as typeof validAudiences[number])
      ? (targetAudienceRaw as 'general' | 'technical' | 'beginner')
      : undefined;
    // Resolve the file path
    const absolutePath = resolve(process.cwd(), filePath);

    // Read the file
    let content: string;
    try {
      content = await readFile(absolutePath, 'utf-8');
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Unknown error';
      return {
        content: [{
          type: 'text',
          text: JSON.stringify({
            error: `Failed to read file: ${message}`,
            filePath: absolutePath,
          }, null, 2),
        }],
      };
    }

    // Prepare options
    const options: ContentAnalysisOptions = {
      targetKeyword,
      targetAudience,
    };

    // Analyze content
    const analysis = analyzeMarkdownContent(content, options);
    const instructions = generateContentInstructions(analysis, options);
    const summary = calculateCategoryScores(analysis, instructions);

    // Calculate overall score
    const overallScore = Math.round(
      (summary.seo.score * 0.4) +
      (summary.readability.score * 0.35) +
      (summary.structure.score * 0.25)
    );

    // Generate overview text
    const criticalCount = instructions.filter(i => i.priority === 'critical').length;
    const highCount = instructions.filter(i => i.priority === 'high').length;
    const mediumCount = instructions.filter(i => i.priority === 'medium').length;
    const lowCount = instructions.filter(i => i.priority === 'low').length;

    let overview = `Content Score: ${overallScore}/100. `;
    if (criticalCount > 0) {
      overview += `${criticalCount} critical issue(s) need immediate attention. `;
    }
    if (highCount > 0) {
      overview += `${highCount} high priority improvement(s). `;
    }
    if (mediumCount > 0 || lowCount > 0) {
      overview += `${mediumCount + lowCount} additional suggestions.`;
    }
    if (instructions.length === 0) {
      overview = 'Content looks great! No major improvements needed.';
    }

    const result: ContentFixResult = {
      filePath,
      score: overallScore,
      wordCount: analysis.seo.wordCount,
      instructions,
      summary,
      overview,
    };

    return {
      content: [{
        type: 'text',
        text: JSON.stringify(result, null, 2),
      }],
    };
  });
};
