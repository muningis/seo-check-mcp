/**
 * Types for content improvement instructions (markdown files)
 */

import type { Priority } from './instructions';

export type ContentCategory = 'seo' | 'readability' | 'structure';
export type ContentTargetType = 'line' | 'range' | 'heading' | 'paragraph' | 'frontmatter';
export type ContentActionType = 'replace' | 'add' | 'remove' | 'split' | 'merge';

export interface ContentTarget {
  type: ContentTargetType;
  lineNumber?: number;      // For single line targets
  startLine?: number;       // For range targets
  endLine?: number;         // For range targets
  selector?: string;        // For headings (e.g., "## Introduction")
}

export interface ContentValue {
  current?: string;
  suggested: string;
}

export interface ContentInstruction {
  action: ContentActionType;
  target: ContentTarget;
  value: ContentValue;
  reason: string;
  priority: Priority;
  category: ContentCategory;
  automated: boolean;       // Can be safely auto-applied
}

export interface CategoryScore {
  score: number;
  issues: number;
}

export interface ContentAnalysisSummary {
  seo: CategoryScore;
  readability: CategoryScore;
  structure: CategoryScore;
}

export interface ContentFixResult {
  filePath: string;
  score: number;
  wordCount: number;
  instructions: ContentInstruction[];
  summary: ContentAnalysisSummary;
  overview: string;
}

export interface ContentAnalysisOptions {
  targetKeyword?: string;
  targetAudience?: 'general' | 'technical' | 'beginner';
}

export interface ReadabilityMetrics {
  fleschKincaid: number;
  avgSentenceLength: number;
  avgWordLength: number;
  complexWordPercentage: number;
  passiveVoiceCount: number;
}

export interface SEOMetrics {
  wordCount: number;
  keywordCount: number;
  keywordDensity: number;
  keywordInFirstParagraph: boolean;
  keywordInHeadings: number;
  hasMetaDescription: boolean;
}

export interface StructureMetrics {
  headingCount: number;
  h1Count: number;
  hasProperHierarchy: boolean;
  skippedLevels: string[];
  avgParagraphLength: number;
  listCount: number;
  codeBlockCount: number;
}

export interface ContentAnalysisResult {
  readability: ReadabilityMetrics;
  seo: SEOMetrics;
  structure: StructureMetrics;
  lines: string[];
}
