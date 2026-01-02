/**
 * Content analyzer for markdown files
 * Analyzes SEO, readability, and structure
 */

import {
  extractWords,
  countSentences,
  countSyllables,
  countComplexWords,
  calculateKeywordDensity,
} from './text';
import { fleschKincaidGrade } from './scoring';
import type {
  ContentAnalysisOptions,
  ContentAnalysisResult,
  ContentInstruction,
  ReadabilityMetrics,
  SEOMetrics,
  StructureMetrics,
  ContentAnalysisSummary,
} from '../types/content-instructions';
import type { Priority } from '../types/instructions';

/**
 * Parse markdown content into lines
 */
export const parseMarkdownLines = (content: string): string[] => {
  return content.split('\n');
};

/**
 * Extract frontmatter from markdown
 */
export const extractFrontmatter = (lines: string[]): { frontmatter: Record<string, string>; contentStartLine: number } => {
  const frontmatter: Record<string, string> = {};
  let contentStartLine = 0;

  if (lines[0]?.trim() === '---') {
    for (let i = 1; i < lines.length; i++) {
      if (lines[i]?.trim() === '---') {
        contentStartLine = i + 1;
        break;
      }
      const match = lines[i]?.match(/^(\w+):\s*(.*)$/);
      if (match) {
        frontmatter[match[1]!] = match[2]!.replace(/^["']|["']$/g, '');
      }
    }
  }

  return { frontmatter, contentStartLine };
};

/**
 * Strip markdown syntax to get plain text
 */
export const stripMarkdown = (text: string): string => {
  return text
    // Remove code blocks
    .replace(/```[\s\S]*?```/g, '')
    .replace(/`[^`]+`/g, '')
    // Remove images
    .replace(/!\[.*?\]\(.*?\)/g, '')
    // Remove links but keep text
    .replace(/\[([^\]]+)\]\([^)]+\)/g, '$1')
    // Remove headings markers
    .replace(/^#{1,6}\s+/gm, '')
    // Remove bold/italic
    .replace(/\*\*([^*]+)\*\*/g, '$1')
    .replace(/\*([^*]+)\*/g, '$1')
    .replace(/__([^_]+)__/g, '$1')
    .replace(/_([^_]+)_/g, '$1')
    // Remove blockquotes
    .replace(/^>\s+/gm, '')
    // Remove list markers
    .replace(/^[-*+]\s+/gm, '')
    .replace(/^\d+\.\s+/gm, '')
    // Clean up whitespace
    .replace(/\n{3,}/g, '\n\n')
    .trim();
};

/**
 * Extract headings from markdown
 */
export const extractMarkdownHeadings = (lines: string[]): { level: number; text: string; lineNumber: number }[] => {
  const headings: { level: number; text: string; lineNumber: number }[] = [];

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    const match = line?.match(/^(#{1,6})\s+(.+)$/);
    if (match) {
      headings.push({
        level: match[1]!.length,
        text: match[2]!,
        lineNumber: i + 1,
      });
    }
  }

  return headings;
};

/**
 * Find sentences in markdown that are too long
 */
export const findLongSentences = (lines: string[], maxLength: number = 25): { lineNumber: number; sentence: string; wordCount: number }[] => {
  const longSentences: { lineNumber: number; sentence: string; wordCount: number }[] = [];

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    if (!line || line.startsWith('#') || line.startsWith('```') || line.startsWith('|')) continue;

    // Split into sentences
    const sentences = line.split(/(?<=[.!?])\s+/);
    for (const sentence of sentences) {
      const words = extractWords(sentence);
      if (words.length > maxLength) {
        longSentences.push({
          lineNumber: i + 1,
          sentence: sentence.trim(),
          wordCount: words.length,
        });
      }
    }
  }

  return longSentences;
};

/**
 * Find paragraphs that are too long
 */
export const findLongParagraphs = (lines: string[], maxSentences: number = 5): { startLine: number; endLine: number; sentenceCount: number }[] => {
  const longParagraphs: { startLine: number; endLine: number; sentenceCount: number }[] = [];
  let paragraphStart = -1;
  let paragraphText = '';

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];

    if (line?.trim() === '') {
      if (paragraphStart >= 0 && paragraphText.trim()) {
        const sentenceCount = countSentences(paragraphText);
        if (sentenceCount > maxSentences) {
          longParagraphs.push({
            startLine: paragraphStart + 1,
            endLine: i,
            sentenceCount,
          });
        }
      }
      paragraphStart = -1;
      paragraphText = '';
    } else if (!line?.startsWith('#') && !line?.startsWith('```') && !line?.startsWith('-') && !line?.startsWith('|')) {
      if (paragraphStart < 0) paragraphStart = i;
      paragraphText += ' ' + line;
    }
  }

  // Check last paragraph
  if (paragraphStart >= 0 && paragraphText.trim()) {
    const sentenceCount = countSentences(paragraphText);
    if (sentenceCount > maxSentences) {
      longParagraphs.push({
        startLine: paragraphStart + 1,
        endLine: lines.length,
        sentenceCount,
      });
    }
  }

  return longParagraphs;
};

/**
 * Detect passive voice patterns
 */
export const detectPassiveVoice = (lines: string[]): { lineNumber: number; text: string }[] => {
  const passivePatterns = [
    /\b(is|are|was|were|be|been|being)\s+(\w+ed|written|done|made|taken|given|shown|known|found|thought|seen)\b/gi,
  ];

  const instances: { lineNumber: number; text: string }[] = [];

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    if (!line) continue;

    for (const pattern of passivePatterns) {
      const matches = line.match(pattern);
      if (matches) {
        for (const match of matches) {
          instances.push({ lineNumber: i + 1, text: match });
        }
      }
    }
  }

  return instances;
};

/**
 * Analyze readability metrics
 */
export const analyzeReadability = (content: string, lines: string[]): ReadabilityMetrics => {
  const plainText = stripMarkdown(content);
  const words = extractWords(plainText);
  const sentences = countSentences(plainText);
  const complexWords = countComplexWords(plainText);
  const passiveInstances = detectPassiveVoice(lines);

  return {
    fleschKincaid: Math.round(fleschKincaidGrade(plainText) * 10) / 10,
    avgSentenceLength: Math.round((words.length / Math.max(sentences, 1)) * 10) / 10,
    avgWordLength: words.length > 0
      ? Math.round((words.join('').length / words.length) * 10) / 10
      : 0,
    complexWordPercentage: words.length > 0
      ? Math.round((complexWords / words.length) * 1000) / 10
      : 0,
    passiveVoiceCount: passiveInstances.length,
  };
};

/**
 * Analyze SEO metrics
 */
export const analyzeSEO = (content: string, lines: string[], options: ContentAnalysisOptions): SEOMetrics => {
  const plainText = stripMarkdown(content);
  const words = extractWords(plainText);
  const headings = extractMarkdownHeadings(lines);
  const { frontmatter } = extractFrontmatter(lines);

  const keyword = options.targetKeyword?.toLowerCase() || '';
  const keywordCount = keyword ? words.filter(w => w === keyword).length : 0;
  const keywordDensity = keyword ? calculateKeywordDensity(plainText, keyword) : 0;

  // Check if keyword is in first paragraph
  const firstParagraph = lines.find(l => l && !l.startsWith('#') && !l.startsWith('---') && l.trim() !== '');
  const keywordInFirstParagraph = keyword && firstParagraph
    ? firstParagraph.toLowerCase().includes(keyword)
    : false;

  // Count keyword in headings
  const keywordInHeadings = keyword
    ? headings.filter(h => h.text.toLowerCase().includes(keyword)).length
    : 0;

  return {
    wordCount: words.length,
    keywordCount,
    keywordDensity: Math.round(keywordDensity * 100) / 100,
    keywordInFirstParagraph,
    keywordInHeadings,
    hasMetaDescription: !!frontmatter.description,
  };
};

/**
 * Analyze structure metrics
 */
export const analyzeStructure = (lines: string[]): StructureMetrics => {
  const headings = extractMarkdownHeadings(lines);
  const h1Count = headings.filter(h => h.level === 1).length;

  // Check for skipped levels
  const skippedLevels: string[] = [];
  let previousLevel = 0;
  for (const heading of headings) {
    if (heading.level > previousLevel + 1 && previousLevel > 0) {
      skippedLevels.push(`H${previousLevel} → H${heading.level}`);
    }
    previousLevel = heading.level;
  }

  // Count lists
  let listCount = 0;
  for (const line of lines) {
    if (line?.match(/^[-*+]\s+/) || line?.match(/^\d+\.\s+/)) {
      listCount++;
    }
  }

  // Count code blocks
  let codeBlockCount = 0;
  let inCodeBlock = false;
  for (const line of lines) {
    if (line?.startsWith('```')) {
      if (!inCodeBlock) codeBlockCount++;
      inCodeBlock = !inCodeBlock;
    }
  }

  // Calculate average paragraph length
  const paragraphs: string[] = [];
  let currentParagraph = '';
  for (const line of lines) {
    if (line?.trim() === '') {
      if (currentParagraph.trim()) {
        paragraphs.push(currentParagraph.trim());
      }
      currentParagraph = '';
    } else if (!line?.startsWith('#') && !line?.startsWith('```') && !line?.startsWith('-') && !line?.startsWith('|')) {
      currentParagraph += ' ' + line;
    }
  }
  if (currentParagraph.trim()) paragraphs.push(currentParagraph.trim());

  const avgParagraphLength = paragraphs.length > 0
    ? Math.round(paragraphs.reduce((sum, p) => sum + extractWords(p).length, 0) / paragraphs.length)
    : 0;

  return {
    headingCount: headings.length,
    h1Count,
    hasProperHierarchy: skippedLevels.length === 0,
    skippedLevels,
    avgParagraphLength,
    listCount,
    codeBlockCount,
  };
};

/**
 * Main analysis function
 */
export const analyzeMarkdownContent = (content: string, options: ContentAnalysisOptions = {}): ContentAnalysisResult => {
  const lines = parseMarkdownLines(content);

  return {
    readability: analyzeReadability(content, lines),
    seo: analyzeSEO(content, lines, options),
    structure: analyzeStructure(lines),
    lines,
  };
};

/**
 * Generate content improvement instructions
 */
export const generateContentInstructions = (
  analysis: ContentAnalysisResult,
  options: ContentAnalysisOptions = {}
): ContentInstruction[] => {
  const instructions: ContentInstruction[] = [];
  const lines = analysis.lines;

  // SEO Instructions
  const seo = analysis.seo;

  // Word count check
  if (seo.wordCount < 300) {
    instructions.push({
      action: 'add',
      target: { type: 'paragraph' },
      value: {
        current: `${seo.wordCount} words`,
        suggested: 'Add more content to reach at least 300 words for SEO. Aim for 1000-2000 words for blog posts.',
      },
      reason: 'Content is too short. Search engines prefer longer, comprehensive content.',
      priority: 'high',
      category: 'seo',
      automated: false,
    });
  } else if (seo.wordCount < 1000 && seo.wordCount >= 300) {
    instructions.push({
      action: 'add',
      target: { type: 'paragraph' },
      value: {
        current: `${seo.wordCount} words`,
        suggested: 'Consider expanding content to 1000-2000 words for better SEO ranking potential.',
      },
      reason: 'Content length is acceptable but could be improved for competitive keywords.',
      priority: 'low',
      category: 'seo',
      automated: false,
    });
  }

  // Keyword checks (if keyword provided)
  if (options.targetKeyword) {
    const keyword = options.targetKeyword;

    if (seo.keywordDensity < 0.5) {
      instructions.push({
        action: 'add',
        target: { type: 'paragraph' },
        value: {
          current: `Keyword "${keyword}" density: ${seo.keywordDensity}%`,
          suggested: `Increase usage of "${keyword}" to reach 1-3% density. Currently at ${seo.keywordDensity}%.`,
        },
        reason: 'Keyword density is too low. Include the target keyword more naturally throughout the content.',
        priority: 'high',
        category: 'seo',
        automated: false,
      });
    } else if (seo.keywordDensity > 3) {
      instructions.push({
        action: 'replace',
        target: { type: 'paragraph' },
        value: {
          current: `Keyword "${keyword}" density: ${seo.keywordDensity}%`,
          suggested: `Reduce usage of "${keyword}" to 1-3% density. Currently at ${seo.keywordDensity}% which may appear as keyword stuffing.`,
        },
        reason: 'Keyword density is too high and may be seen as keyword stuffing by search engines.',
        priority: 'high',
        category: 'seo',
        automated: false,
      });
    }

    if (!seo.keywordInFirstParagraph) {
      instructions.push({
        action: 'add',
        target: { type: 'paragraph', selector: 'first paragraph' },
        value: {
          suggested: `Include "${keyword}" in the first paragraph/introduction.`,
        },
        reason: 'Target keyword should appear early in the content for SEO.',
        priority: 'medium',
        category: 'seo',
        automated: false,
      });
    }

    if (seo.keywordInHeadings === 0) {
      instructions.push({
        action: 'add',
        target: { type: 'heading' },
        value: {
          suggested: `Include "${keyword}" in at least one heading (H2 or H3).`,
        },
        reason: 'Keywords in headings signal topic relevance to search engines.',
        priority: 'medium',
        category: 'seo',
        automated: false,
      });
    }
  }

  // Meta description check
  if (!seo.hasMetaDescription) {
    instructions.push({
      action: 'add',
      target: { type: 'frontmatter' },
      value: {
        suggested: 'description: "Your 150-160 character meta description here"',
      },
      reason: 'Missing meta description in frontmatter. Add a compelling description for search results.',
      priority: 'high',
      category: 'seo',
      automated: true,
    });
  }

  // Readability Instructions
  const readability = analysis.readability;

  // Target audience adjustments
  const targetGrade = options.targetAudience === 'technical' ? 12 : options.targetAudience === 'beginner' ? 6 : 8;

  if (readability.fleschKincaid > targetGrade + 2) {
    instructions.push({
      action: 'replace',
      target: { type: 'paragraph' },
      value: {
        current: `Grade level: ${readability.fleschKincaid}`,
        suggested: `Simplify language to reach grade level ${targetGrade}. Use shorter sentences and simpler words.`,
      },
      reason: `Content is too complex for ${options.targetAudience || 'general'} audience.`,
      priority: 'medium',
      category: 'readability',
      automated: false,
    });
  }

  // Long sentences
  const longSentences = findLongSentences(lines, 25);
  for (const { lineNumber, sentence, wordCount } of longSentences.slice(0, 5)) {
    instructions.push({
      action: 'split',
      target: { type: 'line', lineNumber },
      value: {
        current: sentence.length > 80 ? sentence.substring(0, 80) + '...' : sentence,
        suggested: 'Break this sentence into 2-3 shorter sentences.',
      },
      reason: `Sentence has ${wordCount} words. Keep sentences under 20-25 words for better readability.`,
      priority: 'medium',
      category: 'readability',
      automated: false,
    });
  }

  // Long paragraphs
  const longParagraphs = findLongParagraphs(lines, 5);
  for (const { startLine, sentenceCount } of longParagraphs.slice(0, 3)) {
    instructions.push({
      action: 'split',
      target: { type: 'range', startLine },
      value: {
        current: `${sentenceCount} sentences`,
        suggested: 'Break this paragraph into smaller paragraphs (3-4 sentences each).',
      },
      reason: 'Long paragraphs reduce readability. Break into digestible chunks.',
      priority: 'low',
      category: 'readability',
      automated: false,
    });
  }

  // Passive voice
  const passiveInstances = detectPassiveVoice(lines);
  if (passiveInstances.length > 3) {
    const examples = passiveInstances.slice(0, 3).map(p => `Line ${p.lineNumber}: "${p.text}"`).join(', ');
    instructions.push({
      action: 'replace',
      target: { type: 'paragraph' },
      value: {
        current: `${passiveInstances.length} passive voice instances`,
        suggested: `Rewrite using active voice. Examples: ${examples}`,
      },
      reason: 'Excessive passive voice makes content feel weak. Use active voice for more engaging content.',
      priority: 'low',
      category: 'readability',
      automated: false,
    });
  }

  // Complex words
  if (readability.complexWordPercentage > 15) {
    instructions.push({
      action: 'replace',
      target: { type: 'paragraph' },
      value: {
        current: `${readability.complexWordPercentage}% complex words`,
        suggested: 'Replace complex words (3+ syllables) with simpler alternatives where possible.',
      },
      reason: 'Too many complex words reduce readability. Aim for under 15% complex words.',
      priority: 'medium',
      category: 'readability',
      automated: false,
    });
  }

  // Structure Instructions
  const structure = analysis.structure;

  // H1 check
  if (structure.h1Count === 0) {
    instructions.push({
      action: 'add',
      target: { type: 'heading', lineNumber: 1 },
      value: {
        suggested: '# Your Main Title Here',
      },
      reason: 'Missing H1 heading. Every page should have exactly one H1.',
      priority: 'critical',
      category: 'structure',
      automated: true,
    });
  } else if (structure.h1Count > 1) {
    const headings = extractMarkdownHeadings(lines).filter(h => h.level === 1);
    for (const h of headings.slice(1)) {
      instructions.push({
        action: 'replace',
        target: { type: 'heading', lineNumber: h.lineNumber, selector: `# ${h.text}` },
        value: {
          current: `# ${h.text}`,
          suggested: `## ${h.text}`,
        },
        reason: 'Multiple H1 headings found. Convert additional H1s to H2.',
        priority: 'high',
        category: 'structure',
        automated: true,
      });
    }
  }

  // Heading hierarchy
  if (!structure.hasProperHierarchy) {
    for (const skip of structure.skippedLevels) {
      instructions.push({
        action: 'replace',
        target: { type: 'heading' },
        value: {
          current: skip,
          suggested: `Fix heading hierarchy - don't skip levels (${skip})`,
        },
        reason: 'Skipped heading levels hurt accessibility and SEO. Use sequential levels.',
        priority: 'medium',
        category: 'structure',
        automated: false,
      });
    }
  }

  // Suggest headings if too few
  if (structure.headingCount < 3 && seo.wordCount > 500) {
    instructions.push({
      action: 'add',
      target: { type: 'heading' },
      value: {
        suggested: 'Add H2 subheadings to break up content into sections.',
      },
      reason: 'Long content should be divided with subheadings for better scanability.',
      priority: 'medium',
      category: 'structure',
      automated: false,
    });
  }

  // Sort by priority
  const priorityOrder: Record<Priority, number> = { critical: 0, high: 1, medium: 2, low: 3 };
  instructions.sort((a, b) => priorityOrder[a.priority] - priorityOrder[b.priority]);

  return instructions;
};

/**
 * Calculate category scores
 */
export const calculateCategoryScores = (analysis: ContentAnalysisResult, instructions: ContentInstruction[]): ContentAnalysisSummary => {
  const seoIssues = instructions.filter(i => i.category === 'seo').length;
  const readabilityIssues = instructions.filter(i => i.category === 'readability').length;
  const structureIssues = instructions.filter(i => i.category === 'structure').length;

  // Calculate scores (100 - penalties)
  const seoScore = Math.max(0, 100 - (seoIssues * 15));
  const readabilityScore = Math.max(0, 100 - (readabilityIssues * 10));
  const structureScore = Math.max(0, 100 - (structureIssues * 12));

  return {
    seo: { score: seoScore, issues: seoIssues },
    readability: { score: readabilityScore, issues: readabilityIssues },
    structure: { score: structureScore, issues: structureIssues },
  };
};
