/**
 * Semantic HTML and accessibility suggestions
 */

import type {
  LandmarkElements,
  AriaInfo,
  AccessibilityIssue,
  SemanticScore,
} from '../types/mod';

export interface SemanticSuggestion {
  issues: string[];
  suggestions: string[];
  passedChecks: string[];
}

export const analyzeSemanticStructure = (
  landmarks: LandmarkElements,
  aria: AriaInfo,
  accessibilityIssues: AccessibilityIssue[]
): SemanticSuggestion => {
  const issues: string[] = [];
  const suggestions: string[] = [];
  const passedChecks: string[] = [];

  // Landmark analysis
  if (landmarks.main.count === 0) {
    issues.push('Missing <main> landmark element');
    suggestions.push('Add a <main> element to wrap your primary content');
  } else if (landmarks.main.count === 1) {
    passedChecks.push('Page has exactly one <main> element');
  } else {
    issues.push(`Multiple <main> elements found (${landmarks.main.count})`);
    suggestions.push('Use only one <main> element per page');
  }

  if (landmarks.header.count === 0) {
    suggestions.push('Consider adding a <header> element for your page header');
  } else {
    passedChecks.push('Page has <header> element');
  }

  if (landmarks.footer.count === 0) {
    suggestions.push('Consider adding a <footer> element for your page footer');
  } else {
    passedChecks.push('Page has <footer> element');
  }

  if (landmarks.nav.count === 0) {
    suggestions.push('Consider wrapping navigation links in a <nav> element');
  } else {
    passedChecks.push(`Page has ${landmarks.nav.count} <nav> element(s)`);
  }

  // Section analysis
  if (landmarks.section.count > 0) {
    const sectionsWithoutLabel = landmarks.section.elements.filter(
      s => !s.hasAriaLabel && !s.hasId
    ).length;
    if (sectionsWithoutLabel > 0) {
      suggestions.push(
        `${sectionsWithoutLabel} <section> element(s) lack aria-label or id for identification`
      );
    }
  }

  // Article analysis
  if (landmarks.article.count > 0) {
    passedChecks.push(`Page uses <article> elements (${landmarks.article.count})`);
  }

  // ARIA analysis
  if (aria.ariaLabelCount > 0 || aria.ariaLabelledByCount > 0) {
    passedChecks.push('Page uses ARIA labels for accessibility');
  }

  if (aria.roleCount > 0) {
    passedChecks.push(`Page uses ${aria.roleCount} explicit ARIA roles`);
  }

  // Accessibility issue summary
  const criticalIssues = accessibilityIssues.filter(i => i.impact === 'critical');
  const seriousIssues = accessibilityIssues.filter(i => i.impact === 'serious');

  if (criticalIssues.length > 0) {
    issues.push(`${criticalIssues.length} critical accessibility issue(s) found`);
  }

  if (seriousIssues.length > 0) {
    issues.push(`${seriousIssues.length} serious accessibility issue(s) found`);
  }

  if (criticalIssues.length === 0 && seriousIssues.length === 0) {
    passedChecks.push('No critical or serious accessibility issues detected');
  }

  return { issues, suggestions, passedChecks };
};

export const calculateSemanticScore = (
  landmarks: LandmarkElements,
  aria: AriaInfo,
  accessibilityIssues: AccessibilityIssue[]
): SemanticScore => {
  // Landmarks score (40 points max)
  let landmarkScore = 0;
  if (landmarks.main.count === 1) landmarkScore += 10;
  if (landmarks.header.count >= 1) landmarkScore += 8;
  if (landmarks.footer.count >= 1) landmarkScore += 8;
  if (landmarks.nav.count >= 1) landmarkScore += 7;
  if (landmarks.article.count >= 1 || landmarks.section.count >= 1) landmarkScore += 7;

  // ARIA score (30 points max)
  let ariaScore = 0;
  if (aria.ariaLabelCount > 0 || aria.ariaLabelledByCount > 0) ariaScore += 15;
  if (aria.roleCount > 0) ariaScore += 10;
  if (aria.ariaDescribedByCount > 0) ariaScore += 5;

  // WCAG A score (30 points max)
  // Start with full score and deduct for issues
  let wcagScore = 30;
  for (const issue of accessibilityIssues) {
    switch (issue.impact) {
      case 'critical':
        wcagScore -= 5;
        break;
      case 'serious':
        wcagScore -= 3;
        break;
      case 'moderate':
        wcagScore -= 2;
        break;
      case 'minor':
        wcagScore -= 1;
        break;
    }
  }
  wcagScore = Math.max(0, wcagScore);

  const overall = landmarkScore + ariaScore + wcagScore;

  return {
    landmarks: landmarkScore,
    aria: ariaScore,
    wcagA: wcagScore,
    overall,
  };
};
