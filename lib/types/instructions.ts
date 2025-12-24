/**
 * Types for actionable SEO fix instructions
 * These structured instructions allow Claude Code to understand and apply fixes
 */

export type ActionType = 'add' | 'replace' | 'update' | 'remove';
export type TargetType = 'html-tag' | 'html-attribute' | 'content';
export type Priority = 'critical' | 'high' | 'medium' | 'low';
export type Effort = 'low' | 'medium' | 'high';
export type Impact = 'low' | 'medium' | 'high';

export interface InstructionTarget {
  type: TargetType;
  selector?: string;      // CSS selector (e.g., 'head', 'img[src="..."]')
  tagName?: string;       // For new elements (e.g., 'meta', 'link')
  attribute?: string;     // For attribute changes (e.g., 'alt', 'content')
}

export interface InstructionValue {
  current?: string;       // Current value (for context)
  suggested: string;      // New value or full HTML snippet
}

export interface ActionableInstruction {
  action: ActionType;
  target: InstructionTarget;
  value: InstructionValue;
  reason: string;           // Why this change improves SEO
  priority: Priority;
  automated: boolean;       // Can be safely auto-applied
}

export interface FixResult {
  url: string;
  instructions: ActionableInstruction[];
  summary: string;
}

export interface SEOTask {
  id: string;
  description: string;
  tool: string;
  priority: Priority;
  effort: Effort;
  impact: Impact;
}

export interface SEOTasksResult {
  url: string;
  score: number;
  tasks: SEOTask[];
  quickWins: string[];
  summary: string;
}
