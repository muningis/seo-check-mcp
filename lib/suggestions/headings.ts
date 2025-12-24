/**
 * Heading structure suggestions generator
 */

import type { HeadingData } from '../types/mod';

export interface HeadingSuggestion {
  issues: string[];
  recommendations: string[];
  structure: HeadingStructureAnalysis;
}

export interface HeadingStructureAnalysis {
  h1Count: number;
  h2Count: number;
  h3Count: number;
  h4Count: number;
  h5Count: number;
  h6Count: number;
  totalHeadings: number;
  hasProperHierarchy: boolean;
  skippedLevels: number[];
}

export interface HeadingContent {
  h1: HeadingData;
  h2: HeadingData;
  h3: HeadingData;
  h4: HeadingData;
  h5: HeadingData;
  h6: HeadingData;
}

/**
 * Analyze heading structure
 */
export const analyzeHeadingStructure = (headings: HeadingContent): HeadingStructureAnalysis => {
  const counts = {
    h1Count: headings.h1.count,
    h2Count: headings.h2.count,
    h3Count: headings.h3.count,
    h4Count: headings.h4.count,
    h5Count: headings.h5.count,
    h6Count: headings.h6.count,
  };

  const totalHeadings = Object.values(counts).reduce((a, b) => a + b, 0);

  // Check for skipped levels
  const skippedLevels: number[] = [];
  const levels = [counts.h1Count, counts.h2Count, counts.h3Count, counts.h4Count, counts.h5Count, counts.h6Count];

  let foundFirst = false;
  let lastUsedLevel = 0;

  for (let i = 0; i < levels.length; i++) {
    if ((levels[i] ?? 0) > 0) {
      if (!foundFirst) {
        foundFirst = true;
        lastUsedLevel = i;
      } else {
        // Check if we skipped any levels
        for (let j = lastUsedLevel + 1; j < i; j++) {
          if (levels[j] === 0) {
            skippedLevels.push(j + 1); // Convert to H1-H6 numbering
          }
        }
        lastUsedLevel = i;
      }
    }
  }

  const hasProperHierarchy = skippedLevels.length === 0 && counts.h1Count <= 1;

  return {
    ...counts,
    totalHeadings,
    hasProperHierarchy,
    skippedLevels,
  };
};

/**
 * Generate heading suggestions
 */
export const suggestHeadingImprovements = (
  headings: HeadingContent,
  targetKeyword?: string
): HeadingSuggestion => {
  const issues: string[] = [];
  const recommendations: string[] = [];
  const structure = analyzeHeadingStructure(headings);

  // H1 issues
  if (structure.h1Count === 0) {
    issues.push('Missing H1 tag - every page should have exactly one H1');
    recommendations.push('Add a single H1 heading that describes the main topic of the page');
  } else if (structure.h1Count > 1) {
    issues.push(`Multiple H1 tags found (${structure.h1Count}) - use only one H1 per page`);
    recommendations.push('Convert additional H1s to H2s or lower');
  }

  // Hierarchy issues
  if (structure.skippedLevels.length > 0) {
    issues.push(`Skipped heading levels: H${structure.skippedLevels.join(', H')}`);
    recommendations.push('Maintain proper heading hierarchy (H1 → H2 → H3, etc.)');
  }

  // Keyword presence
  if (targetKeyword) {
    const h1Texts = headings.h1.texts.join(' ').toLowerCase();
    if (!h1Texts.includes(targetKeyword.toLowerCase())) {
      recommendations.push(`Consider including target keyword "${targetKeyword}" in H1`);
    }

    const h2Texts = headings.h2.texts.join(' ').toLowerCase();
    if (!h2Texts.includes(targetKeyword.toLowerCase()) && headings.h2.count > 0) {
      recommendations.push(`Consider including target keyword variations in H2 headings`);
    }
  }

  // Content structure
  if (structure.totalHeadings < 3) {
    recommendations.push('Add more headings to break up content and improve readability');
  }

  if (structure.h2Count === 0 && structure.totalHeadings > 1) {
    issues.push('Missing H2 headings - use H2s to structure main content sections');
  }

  // Heading length analysis
  for (const h1Text of headings.h1.texts) {
    if (h1Text.length > 70) {
      recommendations.push('H1 is too long - keep it under 70 characters for better SEO');
    }
    if (h1Text.length < 20) {
      recommendations.push('H1 is too short - make it more descriptive');
    }
  }

  // Check for generic headings
  const genericTerms = ['introduction', 'overview', 'welcome', 'home', 'untitled', 'section'];
  const allHeadingTexts = [
    ...headings.h1.texts,
    ...headings.h2.texts,
    ...headings.h3.texts,
  ].map(t => t.toLowerCase());

  for (const text of allHeadingTexts) {
    if (genericTerms.some(term => text === term || text.startsWith(term + ' '))) {
      recommendations.push(`Avoid generic heading "${text}" - use descriptive, keyword-rich headings`);
      break;
    }
  }

  return { issues, recommendations, structure };
};
