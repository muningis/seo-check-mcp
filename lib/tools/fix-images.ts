import { z } from 'zod/v3';
import { parse as parseHTML } from 'node-html-parser';
import type { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { DEFAULT_HEADERS } from '../config/mod';
import { extractImages } from '../extraction/mod';
import { analyzeImages, generateAltSuggestion } from '../suggestions/mod';
import type { ActionableInstruction, FixResult } from '../types/mod';

export const registerFixImages = (server: McpServer): void => {
  server.registerTool('fix-images', {
    description: 'Returns actionable instructions for image SEO fixes (alt text, dimensions, lazy loading)',
    inputSchema: {
      url: z.string().describe('Full URL to analyze'),
    },
  }, async ({ url }) => {
    const res = await fetch(url, { headers: DEFAULT_HEADERS });
    const html = await res.text();
    const dom = parseHTML(html);

    const imageStats = extractImages(dom);
    const analysis = analyzeImages(imageStats.details);
    const instructions: ActionableInstruction[] = [];

    // Process each image
    for (let i = 0; i < imageStats.details.length; i++) {
      const img = imageStats.details[i];
      const suggestion = analysis.imageSuggestions[i];

      // Skip if image data is missing
      if (!img) continue;

      // Missing alt text
      if (!img.alt || img.alt.trim() === '') {
        const suggestedAlt = suggestion?.suggestedAlt || generateAltSuggestion(img.src) || 'Descriptive alt text for image';
        const selector = img.src.includes('"')
          ? `img[src='${img.src}']`
          : `img[src="${img.src}"]`;

        instructions.push({
          action: 'add',
          target: {
            type: 'html-attribute',
            selector,
            attribute: 'alt',
          },
          value: {
            current: '',
            suggested: suggestedAlt,
          },
          reason: 'Missing alt text hurts accessibility and SEO. Screen readers need alt text to describe images.',
          priority: 'high',
          automated: true,
        });
      } else if (img.alt.length < 10) {
        // Alt text too short
        const selector = img.src.includes('"')
          ? `img[src='${img.src}']`
          : `img[src="${img.src}"]`;
        const suggestedAlt = generateAltSuggestion(img.src) || `${img.alt} - additional descriptive context`;

        instructions.push({
          action: 'update',
          target: {
            type: 'html-attribute',
            selector,
            attribute: 'alt',
          },
          value: {
            current: img.alt,
            suggested: suggestedAlt,
          },
          reason: `Alt text too short (${img.alt.length} chars). Provide more descriptive context.`,
          priority: 'medium',
          automated: false,
        });
      } else if (img.alt.length > 125) {
        // Alt text too long
        const selector = img.src.includes('"')
          ? `img[src='${img.src}']`
          : `img[src="${img.src}"]`;

        instructions.push({
          action: 'update',
          target: {
            type: 'html-attribute',
            selector,
            attribute: 'alt',
          },
          value: {
            current: img.alt,
            suggested: img.alt.substring(0, 120) + '...',
          },
          reason: `Alt text too long (${img.alt.length} chars). Keep under 125 characters for optimal accessibility.`,
          priority: 'low',
          automated: true,
        });
      }

      // Missing dimensions
      if (!img.width || !img.height) {
        const selector = img.src.includes('"')
          ? `img[src='${img.src}']`
          : `img[src="${img.src}"]`;

        const missingAttrs = [];
        if (!img.width) missingAttrs.push('width');
        if (!img.height) missingAttrs.push('height');

        instructions.push({
          action: 'add',
          target: {
            type: 'html-attribute',
            selector,
            attribute: missingAttrs.join(', '),
          },
          value: {
            suggested: !img.width && !img.height
              ? 'width="[WIDTH]" height="[HEIGHT]"'
              : !img.width
              ? 'width="[WIDTH]"'
              : 'height="[HEIGHT]"',
          },
          reason: 'Missing image dimensions cause Cumulative Layout Shift (CLS). Add explicit width/height to reserve space.',
          priority: 'medium',
          automated: false,
        });
      }

      // Suggest lazy loading for below-fold images (assuming first 3 are above fold)
      if (i >= 3) {
        const selector = img.src.includes('"')
          ? `img[src='${img.src}']`
          : `img[src="${img.src}"]`;

        instructions.push({
          action: 'add',
          target: {
            type: 'html-attribute',
            selector,
            attribute: 'loading',
          },
          value: {
            suggested: 'lazy',
          },
          reason: 'Add lazy loading for below-the-fold images to improve page load performance.',
          priority: 'low',
          automated: true,
        });
      }
    }

    // Check for modern format recommendations
    const nonModernImages = imageStats.details.filter(img => {
      const src = img.src.toLowerCase();
      return !src.includes('.webp') && !src.includes('.avif') &&
        (src.includes('.jpg') || src.includes('.jpeg') || src.includes('.png'));
    });

    if (nonModernImages.length > 0) {
      instructions.push({
        action: 'replace',
        target: {
          type: 'content',
          selector: 'img[src*=".jpg"], img[src*=".jpeg"], img[src*=".png"]',
        },
        value: {
          current: `${nonModernImages.length} images using JPEG/PNG format`,
          suggested: 'Convert to WebP or AVIF format for 25-35% smaller file sizes',
        },
        reason: 'Modern image formats (WebP, AVIF) offer better compression. Use <picture> element with fallbacks.',
        priority: 'medium',
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
        : 'No image SEO issues found',
    };

    return {
      content: [{
        type: 'text',
        text: JSON.stringify(result, null, 2),
      }],
    };
  });
};
