import { z } from 'zod/v3';
import { parse as parseHTML } from 'node-html-parser';
import type { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { DEFAULT_HEADERS } from '../config/mod';
import { extractMeta, extractImages, extractLinks, extractHeadingData, calculateWordCount } from '../extraction/mod';
import { calculateReadabilityScores, scoreTitleTag, scoreMetaDescription, calculateKeywordDensity } from '../analysis/mod';

interface PageMetrics {
  url: string;
  title: { content: string | null; length: number; score: number };
  description: { content: string | null; length: number; score: number };
  wordCount: number;
  readability: { fleschReadingEase: number; grade: number };
  headings: { h1: number; h2: number; h3: number; total: number };
  images: { total: number; withAlt: number; altPercentage: number };
  links: { internal: number; external: number };
  keywordDensity: number | null;
}

interface ComparisonResult {
  url1: PageMetrics;
  url2: PageMetrics;
  comparison: {
    winner: string;
    contentLength: { winner: string; difference: number };
    readability: { winner: string; difference: number };
    titleQuality: { winner: string; difference: number };
    descriptionQuality: { winner: string; difference: number };
    imageOptimization: { winner: string; difference: number };
    internalLinking: { winner: string; difference: number };
  };
  strengths: { url1: string[]; url2: string[] };
  weaknesses: { url1: string[]; url2: string[] };
  recommendations: { url1: string[]; url2: string[] };
}

async function extractPageMetrics(url: string, targetKeyword?: string): Promise<PageMetrics> {
  const res = await fetch(url, { headers: DEFAULT_HEADERS });
  const html = await res.text();
  const dom = parseHTML(html);

  const meta = extractMeta(dom);
  const images = extractImages(dom);
  const links = extractLinks(dom, new URL(url).origin);
  const wordCount = calculateWordCount(dom);

  const body = dom.querySelector('body');
  const scripts = body?.querySelectorAll('script, style, noscript') ?? [];
  scripts.forEach(el => el.remove());
  const textContent = body?.textContent ?? '';

  const readability = calculateReadabilityScores(textContent);

  const titleContent = typeof meta.title === 'string' ? meta.title : null;
  const descContent = typeof meta.description === 'string' ? meta.description : null;

  const h1 = extractHeadingData(dom, 'h1');
  const h2 = extractHeadingData(dom, 'h2');
  const h3 = extractHeadingData(dom, 'h3');

  return {
    url,
    title: {
      content: titleContent,
      length: titleContent?.length ?? 0,
      score: scoreTitleTag(titleContent, targetKeyword),
    },
    description: {
      content: descContent,
      length: descContent?.length ?? 0,
      score: scoreMetaDescription(descContent, targetKeyword),
    },
    wordCount,
    readability: {
      fleschReadingEase: readability.fleschReadingEase,
      grade: readability.fleschKincaidGrade,
    },
    headings: {
      h1: h1.count,
      h2: h2.count,
      h3: h3.count,
      total: h1.count + h2.count + h3.count,
    },
    images: {
      total: images.total,
      withAlt: images.withAlt,
      altPercentage: images.total > 0 ? Math.round((images.withAlt / images.total) * 100) : 100,
    },
    links: {
      internal: links.internal.length,
      external: links.external.length,
    },
    keywordDensity: targetKeyword ? calculateKeywordDensity(textContent, targetKeyword) : null,
  };
}

export const registerComparePages = (server: McpServer): void => {
  server.registerTool('compare-pages', {
    description: 'Compare SEO metrics between two pages with detailed analysis and recommendations',
    inputSchema: {
      url1: z.string().describe('First URL to compare'),
      url2: z.string().describe('Second URL to compare'),
      targetKeyword: z.string().optional().describe('Target keyword for comparison'),
    },
  }, async ({ url1, url2, targetKeyword }) => {
    const [metrics1, metrics2] = await Promise.all([
      extractPageMetrics(url1, targetKeyword),
      extractPageMetrics(url2, targetKeyword),
    ]);

    // Determine winners
    const contentWinner = metrics1.wordCount > metrics2.wordCount ? url1 : url2;
    const readabilityWinner = metrics1.readability.fleschReadingEase > metrics2.readability.fleschReadingEase ? url1 : url2;
    const titleWinner = metrics1.title.score > metrics2.title.score ? url1 : url2;
    const descWinner = metrics1.description.score > metrics2.description.score ? url1 : url2;
    const imageWinner = metrics1.images.altPercentage > metrics2.images.altPercentage ? url1 : url2;
    const linkWinner = metrics1.links.internal > metrics2.links.internal ? url1 : url2;

    // Calculate overall winner
    let score1 = 0, score2 = 0;
    if (contentWinner === url1) score1++; else score2++;
    if (readabilityWinner === url1) score1++; else score2++;
    if (titleWinner === url1) score1++; else score2++;
    if (descWinner === url1) score1++; else score2++;
    if (imageWinner === url1) score1++; else score2++;
    if (linkWinner === url1) score1++; else score2++;

    const overallWinner = score1 > score2 ? url1 : score2 > score1 ? url2 : 'Tie';

    // Identify strengths and weaknesses
    const strengths1: string[] = [];
    const weaknesses1: string[] = [];
    const strengths2: string[] = [];
    const weaknesses2: string[] = [];

    // Content length
    if (metrics1.wordCount > metrics2.wordCount * 1.5) {
      strengths1.push('Significantly more content');
      weaknesses2.push('Less content than competitor');
    } else if (metrics2.wordCount > metrics1.wordCount * 1.5) {
      strengths2.push('Significantly more content');
      weaknesses1.push('Less content than competitor');
    }

    // Readability
    if (metrics1.readability.fleschReadingEase >= 60 && metrics2.readability.fleschReadingEase < 60) {
      strengths1.push('Better readability');
      weaknesses2.push('Content may be too complex');
    } else if (metrics2.readability.fleschReadingEase >= 60 && metrics1.readability.fleschReadingEase < 60) {
      strengths2.push('Better readability');
      weaknesses1.push('Content may be too complex');
    }

    // Title optimization
    if (metrics1.title.score >= 70) strengths1.push('Well-optimized title');
    if (metrics1.title.score < 50) weaknesses1.push('Title needs improvement');
    if (metrics2.title.score >= 70) strengths2.push('Well-optimized title');
    if (metrics2.title.score < 50) weaknesses2.push('Title needs improvement');

    // Image optimization
    if (metrics1.images.altPercentage === 100 && metrics1.images.total > 0) strengths1.push('100% image alt text coverage');
    if (metrics1.images.altPercentage < 80) weaknesses1.push('Missing alt text on images');
    if (metrics2.images.altPercentage === 100 && metrics2.images.total > 0) strengths2.push('100% image alt text coverage');
    if (metrics2.images.altPercentage < 80) weaknesses2.push('Missing alt text on images');

    // Internal linking
    if (metrics1.links.internal > 10) strengths1.push('Strong internal linking');
    if (metrics1.links.internal < 3) weaknesses1.push('Weak internal linking');
    if (metrics2.links.internal > 10) strengths2.push('Strong internal linking');
    if (metrics2.links.internal < 3) weaknesses2.push('Weak internal linking');

    // Generate recommendations
    const recommendations1: string[] = [];
    const recommendations2: string[] = [];

    if (metrics1.wordCount < metrics2.wordCount) {
      recommendations1.push(`Add ${metrics2.wordCount - metrics1.wordCount} more words to match competitor content depth`);
    }
    if (metrics2.wordCount < metrics1.wordCount) {
      recommendations2.push(`Add ${metrics1.wordCount - metrics2.wordCount} more words to match competitor content depth`);
    }

    if (metrics1.title.score < metrics2.title.score) {
      recommendations1.push('Improve title tag optimization');
    }
    if (metrics2.title.score < metrics1.title.score) {
      recommendations2.push('Improve title tag optimization');
    }

    if (metrics1.links.internal < metrics2.links.internal) {
      recommendations1.push(`Add more internal links (competitor has ${metrics2.links.internal - metrics1.links.internal} more)`);
    }
    if (metrics2.links.internal < metrics1.links.internal) {
      recommendations2.push(`Add more internal links (competitor has ${metrics1.links.internal - metrics2.links.internal} more)`);
    }

    const result: ComparisonResult = {
      url1: metrics1,
      url2: metrics2,
      comparison: {
        winner: overallWinner,
        contentLength: {
          winner: contentWinner,
          difference: Math.abs(metrics1.wordCount - metrics2.wordCount),
        },
        readability: {
          winner: readabilityWinner,
          difference: Math.abs(metrics1.readability.fleschReadingEase - metrics2.readability.fleschReadingEase),
        },
        titleQuality: {
          winner: titleWinner,
          difference: Math.abs(metrics1.title.score - metrics2.title.score),
        },
        descriptionQuality: {
          winner: descWinner,
          difference: Math.abs(metrics1.description.score - metrics2.description.score),
        },
        imageOptimization: {
          winner: imageWinner,
          difference: Math.abs(metrics1.images.altPercentage - metrics2.images.altPercentage),
        },
        internalLinking: {
          winner: linkWinner,
          difference: Math.abs(metrics1.links.internal - metrics2.links.internal),
        },
      },
      strengths: { url1: strengths1, url2: strengths2 },
      weaknesses: { url1: weaknesses1, url2: weaknesses2 },
      recommendations: { url1: recommendations1, url2: recommendations2 },
    };

    return {
      content: [{
        type: 'text',
        text: JSON.stringify(result, null, 2),
      }],
    };
  });
};
