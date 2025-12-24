import { z } from 'zod/v3';
import { parse as parseHTML } from 'node-html-parser';
import type { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { DEFAULT_HEADERS } from '../config/mod';
import { extractMeta } from '../extraction/mod';
import type { ActionableInstruction, FixResult, Priority } from '../types/mod';

export const registerFixMeta = (server: McpServer): void => {
  server.registerTool('fix-meta', {
    description: 'Returns actionable instructions for meta tag fixes (title, description, canonical, Open Graph)',
    inputSchema: {
      url: z.string().describe('Full URL to analyze'),
      targetKeyword: z.string().optional().describe('Target keyword for optimization'),
    },
  }, async ({ url, targetKeyword }) => {
    const res = await fetch(url, { headers: DEFAULT_HEADERS });
    const html = await res.text();
    const dom = parseHTML(html);
    const meta = extractMeta(dom);

    const instructions: ActionableInstruction[] = [];

    // Title analysis
    const titleContent = typeof meta.title === 'string' ? meta.title : null;
    const titleLength = titleContent?.length ?? 0;

    if (!titleContent) {
      instructions.push({
        action: 'add',
        target: { type: 'html-tag', selector: 'head', tagName: 'title' },
        value: {
          suggested: targetKeyword
            ? `<title>${targetKeyword} - Your Brand Name</title>`
            : '<title>Descriptive Page Title - Brand Name</title>',
        },
        reason: 'Missing title tag - critical for SEO and search results display.',
        priority: 'critical',
        automated: true,
      });
    } else {
      if (titleLength < 30) {
        instructions.push({
          action: 'replace',
          target: { type: 'html-tag', selector: 'title' },
          value: {
            current: `<title>${titleContent}</title>`,
            suggested: targetKeyword
              ? `<title>${targetKeyword} - ${titleContent} | Brand Name</title>`
              : `<title>${titleContent} - Expanded Description | Brand Name</title>`,
          },
          reason: `Title too short (${titleLength} chars). Optimal length is 50-60 characters.`,
          priority: 'high',
          automated: true,
        });
      } else if (titleLength > 60) {
        const truncated = titleContent.substring(0, 57) + '...';
        instructions.push({
          action: 'replace',
          target: { type: 'html-tag', selector: 'title' },
          value: {
            current: `<title>${titleContent}</title>`,
            suggested: `<title>${titleContent.substring(0, 55)}</title>`,
          },
          reason: `Title too long (${titleLength} chars). Will be truncated to "${truncated}" in search results.`,
          priority: 'medium',
          automated: true,
        });
      }

      if (targetKeyword && !titleContent.toLowerCase().includes(targetKeyword.toLowerCase())) {
        instructions.push({
          action: 'replace',
          target: { type: 'html-tag', selector: 'title' },
          value: {
            current: `<title>${titleContent}</title>`,
            suggested: `<title>${targetKeyword} - ${titleContent}</title>`,
          },
          reason: `Target keyword "${targetKeyword}" not found in title. Keywords should appear early in the title.`,
          priority: 'high',
          automated: false,
        });
      }
    }

    // Description analysis
    const descContent = typeof meta.description === 'string' ? meta.description : null;
    const descLength = descContent?.length ?? 0;

    if (!descContent) {
      instructions.push({
        action: 'add',
        target: { type: 'html-tag', selector: 'head', tagName: 'meta' },
        value: {
          suggested: targetKeyword
            ? `<meta name="description" content="Learn about ${targetKeyword}. Discover key insights and information. Click to explore more.">`
            : '<meta name="description" content="Your compelling page description here. Include key information and a call-to-action.">',
        },
        reason: 'Missing meta description - important for click-through rates from search results.',
        priority: 'critical',
        automated: true,
      });
    } else {
      if (descLength < 120) {
        instructions.push({
          action: 'update',
          target: {
            type: 'html-attribute',
            selector: 'meta[name="description"]',
            attribute: 'content',
          },
          value: {
            current: descContent,
            suggested: `${descContent} Learn more about this topic and discover actionable insights.`,
          },
          reason: `Description too short (${descLength} chars). Optimal length is 150-160 characters.`,
          priority: 'medium',
          automated: true,
        });
      } else if (descLength > 160) {
        instructions.push({
          action: 'update',
          target: {
            type: 'html-attribute',
            selector: 'meta[name="description"]',
            attribute: 'content',
          },
          value: {
            current: descContent,
            suggested: descContent.substring(0, 157) + '...',
          },
          reason: `Description too long (${descLength} chars). Will be truncated in search results.`,
          priority: 'low',
          automated: true,
        });
      }

      if (targetKeyword && !descContent.toLowerCase().includes(targetKeyword.toLowerCase())) {
        instructions.push({
          action: 'update',
          target: {
            type: 'html-attribute',
            selector: 'meta[name="description"]',
            attribute: 'content',
          },
          value: {
            current: descContent,
            suggested: descContent.replace(/^/, `Discover ${targetKeyword}: `),
          },
          reason: `Target keyword "${targetKeyword}" not found in description.`,
          priority: 'medium',
          automated: false,
        });
      }
    }

    // Canonical URL
    const canonicalValue = typeof meta.canonical === 'string' ? meta.canonical : null;
    if (!canonicalValue) {
      instructions.push({
        action: 'add',
        target: { type: 'html-tag', selector: 'head', tagName: 'link' },
        value: {
          suggested: `<link rel="canonical" href="${url}">`,
        },
        reason: 'Missing canonical URL - prevents duplicate content issues and consolidates ranking signals.',
        priority: 'high',
        automated: true,
      });
    }

    // Open Graph tags
    const ogTags: Array<{ name: string; property: string; priority: Priority }> = [
      { name: 'title', property: 'og:title', priority: 'high' },
      { name: 'description', property: 'og:description', priority: 'high' },
      { name: 'image', property: 'og:image', priority: 'medium' },
      { name: 'url', property: 'og:url', priority: 'medium' },
      { name: 'type', property: 'og:type', priority: 'low' },
    ];

    for (const tag of ogTags) {
      const value = meta.og[tag.name as keyof typeof meta.og];
      if (typeof value !== 'string') {
        let suggestedValue = '';

        switch (tag.name) {
          case 'title':
            suggestedValue = titleContent || 'Page Title';
            break;
          case 'description':
            suggestedValue = descContent || 'Page description for social sharing.';
            break;
          case 'url':
            suggestedValue = url;
            break;
          case 'type':
            suggestedValue = 'website';
            break;
          case 'image':
            suggestedValue = 'https://example.com/image.jpg';
            break;
        }

        instructions.push({
          action: 'add',
          target: { type: 'html-tag', selector: 'head', tagName: 'meta' },
          value: {
            suggested: `<meta property="${tag.property}" content="${suggestedValue}">`,
          },
          reason: `Missing ${tag.property} tag - improves social media sharing appearance.`,
          priority: tag.priority,
          automated: tag.name !== 'image',
        });
      }
    }

    // Twitter Card tags
    if (typeof meta.twitter.card !== 'string') {
      instructions.push({
        action: 'add',
        target: { type: 'html-tag', selector: 'head', tagName: 'meta' },
        value: {
          suggested: '<meta name="twitter:card" content="summary_large_image">',
        },
        reason: 'Missing Twitter Card type - required for rich previews on Twitter/X.',
        priority: 'medium',
        automated: true,
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
        : 'No meta tag issues found',
    };

    return {
      content: [{
        type: 'text',
        text: JSON.stringify(result, null, 2),
      }],
    };
  });
};
