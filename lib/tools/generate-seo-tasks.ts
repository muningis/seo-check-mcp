import { z } from 'zod/v3';
import { parse as parseHTML } from 'node-html-parser';
import type { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { DEFAULT_HEADERS } from '../config/mod';
import { extractMeta, extractImages, extractHeadingData, extractLdJson } from '../extraction/mod';
import { analyzeImages, suggestHeadingImprovements } from '../suggestions/mod';
import type { HeadingContent } from '../suggestions/mod';
import type { SEOTask, SEOTasksResult, Priority, Effort, Impact } from '../types/mod';

export const registerGenerateSeoTasks = (server: McpServer): void => {
  server.registerTool('generate-seo-tasks', {
    description: 'Generates a prioritized SEO task list by analyzing all aspects of a page and recommending which fix tools to run',
    inputSchema: {
      url: z.string().describe('Full URL to analyze'),
      targetKeyword: z.string().optional().describe('Target keyword for optimization'),
    },
  }, async ({ url, targetKeyword }) => {
    const res = await fetch(url, { headers: DEFAULT_HEADERS });
    const html = await res.text();
    const dom = parseHTML(html);

    const tasks: SEOTask[] = [];
    let score = 100;

    // 1. Analyze Meta Tags
    const meta = extractMeta(dom);
    const titleContent = typeof meta.title === 'string' ? meta.title : null;
    const descContent = typeof meta.description === 'string' ? meta.description : null;
    const canonical = typeof meta.canonical === 'string' ? meta.canonical : null;

    if (!titleContent) {
      tasks.push({
        id: 'meta-title-missing',
        description: 'Add missing title tag',
        tool: 'fix-meta',
        priority: 'critical',
        effort: 'low',
        impact: 'high',
      });
      score -= 15;
    } else if (titleContent.length < 30 || titleContent.length > 60) {
      tasks.push({
        id: 'meta-title-length',
        description: `Optimize title length (${titleContent.length} chars)`,
        tool: 'fix-meta',
        priority: 'high',
        effort: 'low',
        impact: 'medium',
      });
      score -= 5;
    }

    if (!descContent) {
      tasks.push({
        id: 'meta-desc-missing',
        description: 'Add missing meta description',
        tool: 'fix-meta',
        priority: 'critical',
        effort: 'low',
        impact: 'high',
      });
      score -= 10;
    } else if (descContent.length < 120 || descContent.length > 160) {
      tasks.push({
        id: 'meta-desc-length',
        description: `Optimize description length (${descContent.length} chars)`,
        tool: 'fix-meta',
        priority: 'medium',
        effort: 'low',
        impact: 'medium',
      });
      score -= 3;
    }

    if (!canonical) {
      tasks.push({
        id: 'meta-canonical',
        description: 'Add canonical URL',
        tool: 'fix-meta',
        priority: 'high',
        effort: 'low',
        impact: 'medium',
      });
      score -= 5;
    }

    // Check Open Graph
    const ogMissing = !meta.og.title || !meta.og.description;
    if (ogMissing) {
      tasks.push({
        id: 'meta-og',
        description: 'Add Open Graph meta tags',
        tool: 'fix-meta',
        priority: 'medium',
        effort: 'low',
        impact: 'low',
      });
      score -= 3;
    }

    // 2. Analyze Images
    const imageStats = extractImages(dom);
    const imageAnalysis = analyzeImages(imageStats.details);

    if (imageAnalysis.imagesWithoutAlt > 0) {
      tasks.push({
        id: 'images-alt',
        description: `Add alt text to ${imageAnalysis.imagesWithoutAlt} image(s)`,
        tool: 'fix-images',
        priority: imageAnalysis.imagesWithoutAlt > 3 ? 'high' : 'medium',
        effort: imageAnalysis.imagesWithoutAlt > 5 ? 'high' : 'medium',
        impact: 'medium',
      });
      score -= Math.min(imageAnalysis.imagesWithoutAlt * 2, 10);
    }

    const imagesWithoutDimensions = imageStats.details.filter(img => !img.width || !img.height).length;
    if (imagesWithoutDimensions > 0) {
      tasks.push({
        id: 'images-dimensions',
        description: `Add dimensions to ${imagesWithoutDimensions} image(s)`,
        tool: 'fix-images',
        priority: 'medium',
        effort: 'medium',
        impact: 'medium',
      });
      score -= 3;
    }

    // 3. Analyze Headings
    const headings: HeadingContent = {
      h1: extractHeadingData(dom, 'h1'),
      h2: extractHeadingData(dom, 'h2'),
      h3: extractHeadingData(dom, 'h3'),
      h4: extractHeadingData(dom, 'h4'),
      h5: extractHeadingData(dom, 'h5'),
      h6: extractHeadingData(dom, 'h6'),
    };
    const headingSuggestion = suggestHeadingImprovements(headings, targetKeyword);

    if (headingSuggestion.structure.h1Count === 0) {
      tasks.push({
        id: 'headings-h1-missing',
        description: 'Add H1 heading',
        tool: 'fix-headings',
        priority: 'critical',
        effort: 'low',
        impact: 'high',
      });
      score -= 15;
    } else if (headingSuggestion.structure.h1Count > 1) {
      tasks.push({
        id: 'headings-h1-multiple',
        description: `Reduce H1 tags from ${headingSuggestion.structure.h1Count} to 1`,
        tool: 'fix-headings',
        priority: 'high',
        effort: 'low',
        impact: 'medium',
      });
      score -= 5;
    }

    if (headingSuggestion.structure.skippedLevels.length > 0) {
      tasks.push({
        id: 'headings-hierarchy',
        description: 'Fix heading hierarchy (skipped levels)',
        tool: 'fix-headings',
        priority: 'medium',
        effort: 'medium',
        impact: 'low',
      });
      score -= 3;
    }

    // 4. Analyze Schema/Structured Data
    const ldJson = extractLdJson(dom);

    if (ldJson.length === 0) {
      tasks.push({
        id: 'schema-missing',
        description: 'Add JSON-LD structured data',
        tool: 'fix-schema',
        priority: 'high',
        effort: 'medium',
        impact: 'high',
      });
      score -= 10;
    }

    // Check for Organization schema
    const hasOrgSchema = ldJson.some(data => {
      const type = (data as Record<string, unknown>)['@type'];
      return type === 'Organization' || type === 'LocalBusiness';
    });

    if (!hasOrgSchema && ldJson.length > 0) {
      tasks.push({
        id: 'schema-organization',
        description: 'Add Organization schema',
        tool: 'fix-schema',
        priority: 'medium',
        effort: 'low',
        impact: 'medium',
      });
      score -= 3;
    }

    // Ensure score doesn't go below 0
    score = Math.max(0, score);

    // Sort tasks by priority
    const priorityOrder: Record<Priority, number> = { critical: 0, high: 1, medium: 2, low: 3 };
    tasks.sort((a, b) => priorityOrder[a.priority] - priorityOrder[b.priority]);

    // Identify quick wins (low effort, high/medium impact)
    const quickWins = tasks
      .filter(t => t.effort === 'low' && (t.impact === 'high' || t.impact === 'medium'))
      .map(t => t.id);

    // Generate summary
    const criticalCount = tasks.filter(t => t.priority === 'critical').length;
    const highCount = tasks.filter(t => t.priority === 'high').length;

    let summary = `SEO Score: ${score}/100. `;
    if (criticalCount > 0) {
      summary += `${criticalCount} critical issue(s) need immediate attention. `;
    }
    if (highCount > 0) {
      summary += `${highCount} high priority improvement(s) recommended.`;
    }
    if (criticalCount === 0 && highCount === 0) {
      summary += tasks.length > 0
        ? `${tasks.length} minor improvement(s) available.`
        : 'No major issues found!';
    }

    const result: SEOTasksResult = {
      url,
      score,
      tasks,
      quickWins,
      summary,
    };

    return {
      content: [{
        type: 'text',
        text: JSON.stringify(result, null, 2),
      }],
    };
  });
};
