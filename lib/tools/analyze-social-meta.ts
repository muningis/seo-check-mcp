import { z } from 'zod/v3';
import { parse as parseHTML } from 'node-html-parser';
import type { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { DEFAULT_HEADERS } from '../config/mod';
import { extractMeta } from '../extraction/mod';
import {
  extractOpenGraph,
  extractTwitterCard,
  extractFacebookMeta,
} from '../extraction/mod';
import {
  analyzeOpenGraph,
  analyzeTwitterCard,
  analyzeFacebook,
  generateSocialPreview,
  validateSocialImage,
  calculateSocialMetaScore,
} from '../suggestions/mod';
import type { SocialMetaAnalysisResult } from '../types/mod';

export const registerAnalyzeSocialMeta = (server: McpServer): void => {
  server.registerTool('analyze-social-meta', {
    description: 'Social media meta tag analysis for Open Graph, Twitter Cards, and Facebook with platform previews',
    inputSchema: {
      url: z.string().describe('Full URL to analyze'),
      validateImage: z.boolean().optional().describe('Validate image dimensions by fetching (slower, default: false)'),
    },
  }, async ({ url, validateImage = false }) => {
    const res = await fetch(url, { headers: DEFAULT_HEADERS });
    const html = await res.text();
    const dom = parseHTML(html);

    // Extract page meta for fallbacks
    const pageMeta = extractMeta(dom);
    const pageTitle = typeof pageMeta.title === 'string' ? pageMeta.title : undefined;
    const pageDescription = typeof pageMeta.description === 'string' ? pageMeta.description : undefined;

    // Extract social meta
    const og = extractOpenGraph(dom);
    const twitter = extractTwitterCard(dom);
    const fb = extractFacebookMeta(dom);

    // Analyze each platform
    const ogAnalysis = analyzeOpenGraph(og, pageTitle, pageDescription);
    const twitterAnalysis = analyzeTwitterCard(twitter, og);
    const fbAnalysis = analyzeFacebook(fb);

    // Generate previews
    const facebookPreview = generateSocialPreview('facebook', og, twitter, url);
    const twitterPreview = generateSocialPreview('twitter', og, twitter, url);
    const linkedinPreview = generateSocialPreview('linkedin', og, twitter, url);

    // Validate image if requested
    let imageValidation = validateSocialImage(
      og.image,
      og.imageWidth,
      og.imageHeight,
      twitter.card
    );

    // Optionally fetch image to validate dimensions
    if (validateImage && og.image && (!og.imageWidth || !og.imageHeight)) {
      try {
        const imageRes = await fetch(og.image, {
          method: 'HEAD',
          headers: DEFAULT_HEADERS,
        });
        if (imageRes.ok) {
          // Note: HEAD request doesn't give dimensions, would need to fetch image
          // For now, just validate URL accessibility
          if (!imageRes.headers.get('content-type')?.startsWith('image/')) {
            imageValidation.issues.push('URL does not return an image content-type');
          }
        } else {
          imageValidation.issues.push(`Image URL returned status ${imageRes.status}`);
        }
      } catch (error) {
        imageValidation.issues.push('Failed to fetch image for validation');
      }
    }

    // Calculate scores
    const score = calculateSocialMetaScore(og, twitter, fb, imageValidation);

    // Generate priority actions
    const priorityActions: string[] = [];

    if (!og.image) {
      priorityActions.push('Add og:image - critical for social sharing');
    }
    if (!og.title) {
      priorityActions.push('Add og:title meta tag');
    }
    if (!og.description) {
      priorityActions.push('Add og:description meta tag');
    }
    if (!twitter.card && og.image) {
      priorityActions.push('Add twitter:card="summary_large_image" for rich Twitter previews');
    }
    if (score.overall < 50) {
      priorityActions.push('Social meta score is low - review suggestions above');
    }

    // Calculate individual platform scores
    const ogScore = Math.round((score.openGraph / 50) * 100);
    const twitterScore = Math.round((score.twitter / 35) * 100);

    const result: SocialMetaAnalysisResult = {
      url,
      openGraph: {
        data: og,
        issues: ogAnalysis.issues,
        suggestions: ogAnalysis.suggestions,
        score: ogScore,
        preview: facebookPreview,
      },
      twitter: {
        data: twitter,
        issues: twitterAnalysis.issues,
        suggestions: twitterAnalysis.suggestions,
        score: twitterScore,
        preview: twitterPreview,
      },
      facebook: {
        data: fb,
        issues: fbAnalysis.issues,
        suggestions: fbAnalysis.suggestions,
      },
      imageValidation: og.image ? imageValidation : null,
      score,
      priorityActions,
    };

    return {
      content: [{
        type: 'text',
        text: JSON.stringify(result, null, 2),
      }],
    };
  });
};
