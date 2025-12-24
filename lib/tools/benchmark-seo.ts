import { z } from 'zod/v3';
import { parse as parseHTML } from 'node-html-parser';
import type { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { DEFAULT_HEADERS } from '../config/mod';
import {
  extractMeta,
  extractImages,
  extractLinks,
  extractHeadingData,
  calculateWordCount,
  extractLdJson,
  extractSecurityHeaders,
  headersToRecord,
} from '../extraction/mod';
import { calculateReadabilityScores, scoreTitleTag, scoreMetaDescription } from '../analysis/mod';

interface SEOBenchmarkResult {
  url: string;
  overallScore: number;
  grade: string;
  categoryScores: {
    content: { score: number; maxScore: number; percentage: number };
    technical: { score: number; maxScore: number; percentage: number };
    onPage: { score: number; maxScore: number; percentage: number };
    userExperience: { score: number; maxScore: number; percentage: number };
  };
  checks: Array<{
    category: string;
    name: string;
    passed: boolean;
    score: number;
    maxScore: number;
    details: string;
    priority: 'high' | 'medium' | 'low';
  }>;
  priorityImprovements: Array<{
    priority: 'high' | 'medium' | 'low';
    issue: string;
    recommendation: string;
    potentialImpact: string;
  }>;
  benchmarkComparison: {
    aboveAverage: string[];
    belowAverage: string[];
  };
}

export const registerBenchmarkSeo = (server: McpServer): void => {
  server.registerTool('benchmark-seo', {
    description: 'Comprehensive SEO benchmark with scores, grades, and prioritized improvement recommendations',
    inputSchema: {
      url: z.string().describe('Full URL to benchmark'),
      targetKeyword: z.string().optional().describe('Target keyword for analysis'),
    },
  }, async ({ url, targetKeyword }) => {
    const res = await fetch(url, { headers: DEFAULT_HEADERS });
    const html = await res.text();
    const dom = parseHTML(html);
    const headers = headersToRecord(res.headers);

    const meta = extractMeta(dom);
    const images = extractImages(dom);
    const links = extractLinks(dom, new URL(url).origin);
    const wordCount = calculateWordCount(dom);
    const ldJson = extractLdJson(dom);
    const securityHeaders = extractSecurityHeaders(headers);

    const body = dom.querySelector('body');
    const scripts = body?.querySelectorAll('script, style, noscript') ?? [];
    scripts.forEach(el => el.remove());
    const textContent = body?.textContent ?? '';
    const readability = calculateReadabilityScores(textContent);

    const h1 = extractHeadingData(dom, 'h1');
    const h2 = extractHeadingData(dom, 'h2');

    const titleContent = typeof meta.title === 'string' ? meta.title : null;
    const descContent = typeof meta.description === 'string' ? meta.description : null;
    const canonicalContent = typeof meta.canonical === 'string' ? meta.canonical : null;

    const checks: SEOBenchmarkResult['checks'] = [];
    const priorityImprovements: SEOBenchmarkResult['priorityImprovements'] = [];
    const aboveAverage: string[] = [];
    const belowAverage: string[] = [];

    // Industry averages for comparison
    const BENCHMARKS = {
      wordCount: 1000,
      fleschScore: 60,
      titleScore: 70,
      descScore: 70,
      h1Count: 1,
      altCoverage: 90,
      internalLinks: 5,
    };

    // === CONTENT CHECKS ===

    // Word count (10 points)
    const wordCountPassed = wordCount >= 300;
    const wordCountScore = wordCount >= 1000 ? 10 : wordCount >= 500 ? 7 : wordCount >= 300 ? 5 : 2;
    checks.push({
      category: 'content',
      name: 'Content Length',
      passed: wordCountPassed,
      score: wordCountScore,
      maxScore: 10,
      details: `${wordCount} words (recommended: 500-2000)`,
      priority: wordCount < 300 ? 'high' : 'medium',
    });
    if (wordCount >= BENCHMARKS.wordCount) aboveAverage.push('Content length');
    else belowAverage.push('Content length');

    // Readability (10 points)
    const readabilityPassed = readability.fleschReadingEase >= 50;
    const readabilityScore = readability.fleschReadingEase >= 60 ? 10 : readability.fleschReadingEase >= 50 ? 7 : 4;
    checks.push({
      category: 'content',
      name: 'Readability',
      passed: readabilityPassed,
      score: readabilityScore,
      maxScore: 10,
      details: `Flesch score: ${readability.fleschReadingEase} (${readability.interpretation})`,
      priority: 'medium',
    });
    if (readability.fleschReadingEase >= BENCHMARKS.fleschScore) aboveAverage.push('Readability');
    else belowAverage.push('Readability');

    // === ON-PAGE CHECKS ===

    // Title tag (10 points)
    const titleScore = scoreTitleTag(titleContent, targetKeyword);
    const titlePassed = titleScore >= 50;
    checks.push({
      category: 'onPage',
      name: 'Title Tag',
      passed: titlePassed,
      score: Math.round(titleScore / 10),
      maxScore: 10,
      details: titleContent ? `"${titleContent.substring(0, 50)}..." (${titleContent.length} chars)` : 'Missing',
      priority: 'high',
    });
    if (!titlePassed) {
      priorityImprovements.push({
        priority: 'high',
        issue: 'Title tag needs optimization',
        recommendation: 'Create a compelling 50-60 character title with target keyword',
        potentialImpact: 'Can improve CTR by 20-30%',
      });
    }
    if (titleScore >= BENCHMARKS.titleScore) aboveAverage.push('Title optimization');
    else belowAverage.push('Title optimization');

    // Meta description (10 points)
    const descScore = scoreMetaDescription(descContent, targetKeyword);
    const descPassed = descScore >= 50;
    checks.push({
      category: 'onPage',
      name: 'Meta Description',
      passed: descPassed,
      score: Math.round(descScore / 10),
      maxScore: 10,
      details: descContent ? `${descContent.length} characters` : 'Missing',
      priority: 'high',
    });
    if (!descPassed) {
      priorityImprovements.push({
        priority: 'high',
        issue: 'Meta description needs improvement',
        recommendation: 'Write a 150-160 character description with call-to-action',
        potentialImpact: 'Can improve CTR by 5-10%',
      });
    }
    if (descScore >= BENCHMARKS.descScore) aboveAverage.push('Meta description');
    else belowAverage.push('Meta description');

    // H1 tag (10 points)
    const h1Passed = h1.count === 1;
    const h1Score = h1.count === 1 ? 10 : h1.count === 0 ? 0 : 5;
    checks.push({
      category: 'onPage',
      name: 'H1 Tag',
      passed: h1Passed,
      score: h1Score,
      maxScore: 10,
      details: h1.count === 1 ? `One H1: "${h1.texts[0]?.substring(0, 40)}..."` : `${h1.count} H1 tags found`,
      priority: h1.count === 0 ? 'high' : 'medium',
    });
    if (h1.count === BENCHMARKS.h1Count) aboveAverage.push('H1 structure');
    else belowAverage.push('H1 structure');

    // Content structure (5 points)
    const hasGoodStructure = h2.count >= 2;
    checks.push({
      category: 'onPage',
      name: 'Content Structure',
      passed: hasGoodStructure,
      score: hasGoodStructure ? 5 : 2,
      maxScore: 5,
      details: `${h2.count} H2 headings (recommended: 2+)`,
      priority: 'low',
    });

    // === TECHNICAL CHECKS ===

    // HTTPS (10 points)
    const isHttps = url.startsWith('https://');
    checks.push({
      category: 'technical',
      name: 'HTTPS',
      passed: isHttps,
      score: isHttps ? 10 : 0,
      maxScore: 10,
      details: isHttps ? 'Site uses HTTPS' : 'Site not using HTTPS',
      priority: isHttps ? 'low' : 'high',
    });
    if (!isHttps) {
      priorityImprovements.push({
        priority: 'high',
        issue: 'Site not using HTTPS',
        recommendation: 'Migrate to HTTPS immediately',
        potentialImpact: 'Required for ranking - direct ranking factor',
      });
    }

    // Canonical URL (5 points)
    const hasCanonical = !!canonicalContent;
    checks.push({
      category: 'technical',
      name: 'Canonical URL',
      passed: hasCanonical,
      score: hasCanonical ? 5 : 0,
      maxScore: 5,
      details: hasCanonical ? 'Canonical tag present' : 'Missing canonical tag',
      priority: 'medium',
    });

    // Structured data (5 points)
    const hasStructuredData = ldJson.length > 0;
    checks.push({
      category: 'technical',
      name: 'Structured Data',
      passed: hasStructuredData,
      score: hasStructuredData ? 5 : 0,
      maxScore: 5,
      details: hasStructuredData ? `${ldJson.length} schema(s) found` : 'No structured data',
      priority: 'medium',
    });
    if (!hasStructuredData) {
      priorityImprovements.push({
        priority: 'medium',
        issue: 'No structured data found',
        recommendation: 'Add JSON-LD schema markup',
        potentialImpact: 'Can enable rich results in search',
      });
    }

    // Security headers (5 points)
    const hasSecurityHeaders = !!(securityHeaders.hsts || securityHeaders.csp);
    checks.push({
      category: 'technical',
      name: 'Security Headers',
      passed: hasSecurityHeaders,
      score: hasSecurityHeaders ? 5 : 2,
      maxScore: 5,
      details: hasSecurityHeaders ? 'Security headers configured' : 'Missing security headers',
      priority: 'low',
    });

    // === USER EXPERIENCE CHECKS ===

    // Image alt text (10 points)
    const altCoverage = images.total > 0 ? (images.withAlt / images.total) * 100 : 100;
    const altPassed = altCoverage >= 80;
    checks.push({
      category: 'userExperience',
      name: 'Image Alt Text',
      passed: altPassed,
      score: altCoverage >= 100 ? 10 : altCoverage >= 80 ? 7 : altCoverage >= 50 ? 4 : 2,
      maxScore: 10,
      details: `${Math.round(altCoverage)}% of images have alt text`,
      priority: altCoverage < 50 ? 'high' : 'medium',
    });
    if (altCoverage >= BENCHMARKS.altCoverage) aboveAverage.push('Image optimization');
    else belowAverage.push('Image optimization');

    // Internal linking (5 points)
    const internalLinksPassed = links.internal.length >= 3;
    checks.push({
      category: 'userExperience',
      name: 'Internal Linking',
      passed: internalLinksPassed,
      score: links.internal.length >= 10 ? 5 : links.internal.length >= 5 ? 4 : links.internal.length >= 3 ? 3 : 1,
      maxScore: 5,
      details: `${links.internal.length} internal links`,
      priority: 'medium',
    });
    if (links.internal.length >= BENCHMARKS.internalLinks) aboveAverage.push('Internal linking');
    else belowAverage.push('Internal linking');

    // External linking (5 points)
    const hasExternalLinks = links.external.length >= 1;
    checks.push({
      category: 'userExperience',
      name: 'External Linking',
      passed: hasExternalLinks,
      score: hasExternalLinks ? 5 : 2,
      maxScore: 5,
      details: `${links.external.length} external links`,
      priority: 'low',
    });

    // Calculate category scores
    const contentChecks = checks.filter(c => c.category === 'content');
    const technicalChecks = checks.filter(c => c.category === 'technical');
    const onPageChecks = checks.filter(c => c.category === 'onPage');
    const uxChecks = checks.filter(c => c.category === 'userExperience');

    const calcCategoryScore = (categoryChecks: typeof checks) => {
      const score = categoryChecks.reduce((sum, c) => sum + c.score, 0);
      const maxScore = categoryChecks.reduce((sum, c) => sum + c.maxScore, 0);
      return { score, maxScore, percentage: Math.round((score / maxScore) * 100) };
    };

    const categoryScores = {
      content: calcCategoryScore(contentChecks),
      technical: calcCategoryScore(technicalChecks),
      onPage: calcCategoryScore(onPageChecks),
      userExperience: calcCategoryScore(uxChecks),
    };

    // Calculate overall score
    const totalScore = checks.reduce((sum, c) => sum + c.score, 0);
    const totalMaxScore = checks.reduce((sum, c) => sum + c.maxScore, 0);
    const overallScore = Math.round((totalScore / totalMaxScore) * 100);

    // Determine grade
    let grade: string;
    if (overallScore >= 90) grade = 'A+';
    else if (overallScore >= 80) grade = 'A';
    else if (overallScore >= 70) grade = 'B';
    else if (overallScore >= 60) grade = 'C';
    else if (overallScore >= 50) grade = 'D';
    else grade = 'F';

    // Sort priority improvements
    priorityImprovements.sort((a, b) => {
      const priorityOrder = { high: 0, medium: 1, low: 2 };
      return priorityOrder[a.priority] - priorityOrder[b.priority];
    });

    const result: SEOBenchmarkResult = {
      url,
      overallScore,
      grade,
      categoryScores,
      checks,
      priorityImprovements,
      benchmarkComparison: {
        aboveAverage,
        belowAverage,
      },
    };

    return {
      content: [{
        type: 'text',
        text: JSON.stringify(result, null, 2),
      }],
    };
  });
};
