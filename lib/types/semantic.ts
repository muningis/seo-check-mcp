/**
 * Types for semantic HTML and ARIA accessibility analysis
 */

export type WCAGLevel = 'A' | 'AA' | 'AAA';

export interface SemanticElement {
  tagName: string;
  count: number;
  elements: Array<{
    hasId: boolean;
    hasAriaLabel: boolean;
    hasRole: boolean;
    textContent: string | null;
  }>;
}

export interface LandmarkElements {
  main: SemanticElement;
  header: SemanticElement;
  footer: SemanticElement;
  nav: SemanticElement;
  aside: SemanticElement;
  article: SemanticElement;
  section: SemanticElement;
}

export interface AriaInfo {
  ariaLabelCount: number;
  ariaLabelledByCount: number;
  ariaDescribedByCount: number;
  roleCount: number;
  roleDistribution: Record<string, number>;
  ariaHiddenCount: number;
  ariaLiveCount: number;
}

export interface AccessibilityIssue {
  wcagCriterion: string;
  wcagLevel: WCAGLevel;
  element: string;
  selector: string;
  issue: string;
  recommendation: string;
  impact: 'critical' | 'serious' | 'moderate' | 'minor';
}

export interface SemanticScore {
  landmarks: number;
  aria: number;
  wcagA: number;
  overall: number;
}

export interface SemanticAnalysisResult {
  url: string;
  landmarks: LandmarkElements;
  aria: AriaInfo;
  accessibilityIssues: AccessibilityIssue[];
  score: SemanticScore;
  issues: string[];
  suggestions: string[];
  passedChecks: string[];
}
