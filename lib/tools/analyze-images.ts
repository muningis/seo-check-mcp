import { z } from 'zod/v3';
import { parse as parseHTML } from 'node-html-parser';
import type { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { DEFAULT_HEADERS } from '../config/mod';
import { extractImages } from '../extraction/mod';
import { analyzeImages } from '../suggestions/mod';

interface ImageAnalysisResult {
  url: string;
  statistics: {
    totalImages: number;
    withAlt: number;
    withoutAlt: number;
    withDimensions: number;
    withoutDimensions: number;
    altCoverage: number;
  };
  images: Array<{
    src: string;
    alt: string | null;
    width: string | null;
    height: string | null;
    issues: string[];
    suggestedAlt: string | null;
  }>;
  formatBreakdown: Record<string, number>;
  issues: string[];
  suggestions: string[];
  score: number;
}

export const registerAnalyzeImages = (server: McpServer): void => {
  server.registerTool('analyze-images', {
    description: 'Image SEO analysis with alt text evaluation, suggested improvements, and accessibility checks',
    inputSchema: {
      url: z.string().describe('Full URL to analyze'),
    },
  }, async ({ url }) => {
    const res = await fetch(url, { headers: DEFAULT_HEADERS });
    const html = await res.text();
    const dom = parseHTML(html);

    const imageStats = extractImages(dom);
    const analysis = analyzeImages(imageStats.details);

    // Calculate dimensions stats
    let withDimensions = 0;
    let withoutDimensions = 0;
    const formatBreakdown: Record<string, number> = {};

    for (const img of imageStats.details) {
      if (img.width && img.height) {
        withDimensions++;
      } else {
        withoutDimensions++;
      }

      // Extract format
      const src = img.src.toLowerCase();
      let format = 'unknown';
      if (src.includes('.webp')) format = 'webp';
      else if (src.includes('.avif')) format = 'avif';
      else if (src.includes('.jpg') || src.includes('.jpeg')) format = 'jpeg';
      else if (src.includes('.png')) format = 'png';
      else if (src.includes('.gif')) format = 'gif';
      else if (src.includes('.svg')) format = 'svg';
      else if (src.startsWith('data:image/')) {
        format = src.split(';')[0]?.split('/')[1] ?? 'base64';
      }

      formatBreakdown[format] = (formatBreakdown[format] || 0) + 1;
    }

    // Build issues and suggestions
    const issues: string[] = [];
    const suggestions: string[] = [...analysis.generalRecommendations];

    if (analysis.imagesWithoutAlt > 0) {
      issues.push(`${analysis.imagesWithoutAlt} images missing alt text`);
    }

    if (withoutDimensions > 0) {
      issues.push(`${withoutDimensions} images missing width/height attributes (causes layout shift)`);
    }

    // Format suggestions
    const nonModernFormats = (formatBreakdown['jpeg'] ?? 0) + (formatBreakdown['png'] ?? 0);
    if (nonModernFormats > 0) {
      suggestions.push(`${nonModernFormats} images use JPEG/PNG. Consider WebP for 25-35% smaller file sizes.`);
    }

    // Calculate score
    let score = 0;

    // Alt text coverage (40 points)
    const altCoverage = imageStats.total > 0
      ? (analysis.imagesWithAlt / imageStats.total) * 100
      : 100;

    if (altCoverage === 100) {
      score += 40;
    } else if (altCoverage >= 80) {
      score += 30;
    } else if (altCoverage >= 50) {
      score += 20;
    } else if (altCoverage > 0) {
      score += 10;
    }

    // Dimensions (30 points)
    const dimensionCoverage = imageStats.total > 0
      ? (withDimensions / imageStats.total) * 100
      : 100;

    if (dimensionCoverage === 100) {
      score += 30;
    } else if (dimensionCoverage >= 80) {
      score += 20;
    } else if (dimensionCoverage >= 50) {
      score += 10;
    }

    // Modern formats (20 points)
    const modernFormats = (formatBreakdown['webp'] ?? 0) + (formatBreakdown['avif'] ?? 0);
    const modernRatio = imageStats.total > 0 ? modernFormats / imageStats.total : 1;
    if (modernRatio >= 0.8) {
      score += 20;
    } else if (modernRatio >= 0.5) {
      score += 15;
    } else if (modernRatio > 0) {
      score += 10;
    }

    // Has images bonus (10 points)
    if (imageStats.total > 0) {
      score += 10;
    }

    const result: ImageAnalysisResult = {
      url,
      statistics: {
        totalImages: imageStats.total,
        withAlt: analysis.imagesWithAlt,
        withoutAlt: analysis.imagesWithoutAlt,
        withDimensions,
        withoutDimensions,
        altCoverage: Math.round(altCoverage),
      },
      images: analysis.imageSuggestions.map((img, i) => ({
        src: img.src,
        alt: imageStats.details[i]?.alt ?? null,
        width: imageStats.details[i]?.width ?? null,
        height: imageStats.details[i]?.height ?? null,
        issues: img.issues,
        suggestedAlt: img.suggestedAlt,
      })),
      formatBreakdown,
      issues,
      suggestions,
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
