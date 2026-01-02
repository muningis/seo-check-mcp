/**
 * Types for enhanced JSON-LD schema analysis
 */

export interface SchemaTypeDefinition {
  requiredProperties: string[];
  recommendedProperties: string[];
}

export interface PropertyValidation {
  property: string;
  value: unknown;
  isValid: boolean;
  issue?: string;
  expectedFormat?: string;
}

export interface SchemaAnalysis {
  type: string;
  id?: string;
  isValid: boolean;
  validationScore: number;
  completenessScore: number;
  requiredProperties: PropertyValidation[];
  recommendedProperties: PropertyValidation[];
  missingRequired: string[];
  missingRecommended: string[];
  warnings: string[];
  suggestions: string[];
  rawData?: object;
}

export interface GraphNode {
  id: string;
  type: string;
  referencedBy: string[];
  references: string[];
}

export interface GraphAnalysis {
  hasGraph: boolean;
  nodeCount: number;
  nodes: GraphNode[];
  rootNodes: string[];
  orphanNodes: string[];
  circularReferences: string[];
}

export interface SchemaValidationScore {
  validation: number;
  completeness: number;
  coverage: number;
  overall: number;
}

export interface SchemaValidationResult {
  url: string;
  schemasFound: number;
  schemas: SchemaAnalysis[];
  graphAnalysis: GraphAnalysis | null;
  score: SchemaValidationScore;
  generalSuggestions: string[];
  recommendedSchemas: string[];
}
