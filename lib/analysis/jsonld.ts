/**
 * Extended JSON-LD schema analysis and validation
 */

import type {
  SchemaTypeDefinition,
  PropertyValidation,
  SchemaAnalysis,
  GraphNode,
  GraphAnalysis,
  SchemaValidationScore,
} from '../types/mod';

export const EXTENDED_SCHEMA_TYPES: Record<string, SchemaTypeDefinition> = {
  Article: {
    requiredProperties: ['headline', 'author', 'datePublished'],
    recommendedProperties: ['image', 'dateModified', 'publisher', 'description', 'mainEntityOfPage'],
  },
  NewsArticle: {
    requiredProperties: ['headline', 'author', 'datePublished'],
    recommendedProperties: ['image', 'dateModified', 'publisher', 'description', 'articleBody'],
  },
  BlogPosting: {
    requiredProperties: ['headline', 'author', 'datePublished'],
    recommendedProperties: ['image', 'dateModified', 'publisher', 'description', 'wordCount'],
  },
  Product: {
    requiredProperties: ['name'],
    recommendedProperties: ['image', 'description', 'sku', 'brand', 'offers', 'review', 'aggregateRating'],
  },
  LocalBusiness: {
    requiredProperties: ['name', 'address'],
    recommendedProperties: ['image', 'telephone', 'openingHours', 'priceRange', 'geo', 'review'],
  },
  Organization: {
    requiredProperties: ['name'],
    recommendedProperties: ['url', 'logo', 'contactPoint', 'sameAs', 'description'],
  },
  Person: {
    requiredProperties: ['name'],
    recommendedProperties: ['image', 'url', 'sameAs', 'jobTitle', 'worksFor'],
  },
  WebPage: {
    requiredProperties: ['name'],
    recommendedProperties: ['description', 'breadcrumb', 'mainEntity', 'lastReviewed'],
  },
  WebSite: {
    requiredProperties: ['name', 'url'],
    recommendedProperties: ['potentialAction', 'publisher', 'description'],
  },
  FAQPage: {
    requiredProperties: ['mainEntity'],
    recommendedProperties: [],
  },
  HowTo: {
    requiredProperties: ['name', 'step'],
    recommendedProperties: ['image', 'totalTime', 'estimatedCost', 'supply', 'tool'],
  },
  Recipe: {
    requiredProperties: ['name', 'recipeIngredient'],
    recommendedProperties: ['image', 'author', 'prepTime', 'cookTime', 'recipeInstructions', 'nutrition'],
  },
  Event: {
    requiredProperties: ['name', 'startDate', 'location'],
    recommendedProperties: ['endDate', 'image', 'description', 'offers', 'performer', 'organizer'],
  },
  BreadcrumbList: {
    requiredProperties: ['itemListElement'],
    recommendedProperties: [],
  },
  // Extended schema types
  VideoObject: {
    requiredProperties: ['name', 'description', 'thumbnailUrl', 'uploadDate'],
    recommendedProperties: ['duration', 'contentUrl', 'embedUrl', 'interactionCount', 'expires'],
  },
  ImageObject: {
    requiredProperties: ['contentUrl'],
    recommendedProperties: ['name', 'description', 'caption', 'width', 'height', 'author'],
  },
  Review: {
    requiredProperties: ['itemReviewed', 'author'],
    recommendedProperties: ['reviewRating', 'reviewBody', 'datePublished'],
  },
  AggregateRating: {
    requiredProperties: ['ratingValue'],
    recommendedProperties: ['reviewCount', 'ratingCount', 'bestRating', 'worstRating'],
  },
  Offer: {
    requiredProperties: ['price', 'priceCurrency'],
    recommendedProperties: ['availability', 'priceValidUntil', 'url', 'seller', 'itemCondition'],
  },
  SoftwareApplication: {
    requiredProperties: ['name'],
    recommendedProperties: ['operatingSystem', 'applicationCategory', 'offers', 'aggregateRating', 'screenshot'],
  },
};

const isValidUrl = (value: unknown): boolean => {
  if (typeof value !== 'string') return false;
  try {
    new URL(value);
    return true;
  } catch {
    return false;
  }
};

const isValidISODate = (value: unknown): boolean => {
  if (typeof value !== 'string') return false;
  return /^\d{4}-\d{2}-\d{2}(T\d{2}:\d{2}:\d{2})?/.test(value);
};

const isValidRating = (value: unknown): boolean => {
  if (typeof value === 'number') return value >= 0 && value <= 5;
  if (typeof value === 'string') {
    const num = parseFloat(value);
    return !isNaN(num) && num >= 0 && num <= 5;
  }
  return false;
};

const validateProperty = (
  property: string,
  value: unknown,
  schemaType: string
): PropertyValidation => {
  const validation: PropertyValidation = {
    property,
    value,
    isValid: true,
  };

  // URL validations
  const urlProperties = ['url', 'image', 'logo', 'contentUrl', 'thumbnailUrl', 'embedUrl'];
  if (urlProperties.includes(property)) {
    if (typeof value === 'string' && !isValidUrl(value)) {
      validation.isValid = false;
      validation.issue = 'Invalid URL format';
      validation.expectedFormat = 'https://example.com/path';
    }
  }

  // Date validations
  const dateProperties = ['datePublished', 'dateModified', 'uploadDate', 'expires', 'priceValidUntil'];
  if (dateProperties.includes(property)) {
    if (!isValidISODate(value)) {
      validation.isValid = false;
      validation.issue = 'Invalid date format';
      validation.expectedFormat = 'YYYY-MM-DD or YYYY-MM-DDTHH:MM:SS';
    }
  }

  // Rating validations
  if (property === 'ratingValue') {
    if (!isValidRating(value)) {
      validation.isValid = false;
      validation.issue = 'Rating should be between 0 and 5';
      validation.expectedFormat = 'Number between 0-5';
    }
  }

  // Price validation
  if (property === 'price') {
    if (typeof value !== 'number' && typeof value !== 'string') {
      validation.isValid = false;
      validation.issue = 'Price should be a number or numeric string';
      validation.expectedFormat = 'Number (e.g., 29.99)';
    }
  }

  return validation;
};

export const getSchemaType = (data: object): string => {
  const typed = data as Record<string, unknown>;

  if ('@type' in typed) {
    const type = typed['@type'];
    if (typeof type === 'string') return type;
    if (Array.isArray(type) && type.length > 0) return String(type[0]);
  }

  return 'Unknown';
};

export const hasProperty = (data: object, prop: string): boolean => {
  const typed = data as Record<string, unknown>;
  return prop in typed && typed[prop] !== undefined && typed[prop] !== null;
};

export const analyzeSchema = (data: object): SchemaAnalysis => {
  const type = getSchemaType(data);
  const typed = data as Record<string, unknown>;
  const schemaSpec = EXTENDED_SCHEMA_TYPES[type];

  const requiredProperties: PropertyValidation[] = [];
  const recommendedProperties: PropertyValidation[] = [];
  const missingRequired: string[] = [];
  const missingRecommended: string[] = [];
  const warnings: string[] = [];
  const suggestions: string[] = [];

  if (!schemaSpec) {
    warnings.push(`Schema type "${type}" is not in the known schema registry`);
    return {
      type,
      id: typeof typed['@id'] === 'string' ? typed['@id'] : undefined,
      isValid: type !== 'Unknown',
      validationScore: type === 'Unknown' ? 0 : 50,
      completenessScore: 0,
      requiredProperties,
      recommendedProperties,
      missingRequired,
      missingRecommended,
      warnings,
      suggestions: ['Add a valid @type property from Schema.org vocabulary'],
      rawData: data,
    };
  }

  // Check required properties
  for (const prop of schemaSpec.requiredProperties) {
    if (hasProperty(data, prop)) {
      const validation = validateProperty(prop, typed[prop], type);
      requiredProperties.push(validation);
      if (!validation.isValid) {
        warnings.push(`${prop}: ${validation.issue}`);
      }
    } else {
      missingRequired.push(prop);
    }
  }

  // Check recommended properties
  for (const prop of schemaSpec.recommendedProperties) {
    if (hasProperty(data, prop)) {
      const validation = validateProperty(prop, typed[prop], type);
      recommendedProperties.push(validation);
      if (!validation.isValid) {
        warnings.push(`${prop}: ${validation.issue}`);
      }
    } else {
      missingRecommended.push(prop);
    }
  }

  // Generate suggestions
  if (missingRequired.length > 0) {
    suggestions.push(`Add required properties: ${missingRequired.join(', ')}`);
  }
  if (missingRecommended.length > 0 && missingRecommended.length <= 3) {
    suggestions.push(`Consider adding: ${missingRecommended.join(', ')}`);
  } else if (missingRecommended.length > 3) {
    suggestions.push('Consider adding recommended properties to enhance rich results');
  }

  // Calculate scores
  const requiredTotal = schemaSpec.requiredProperties.length;
  const requiredPresent = requiredTotal - missingRequired.length;
  const requiredValid = requiredProperties.filter(p => p.isValid).length;

  const recommendedTotal = schemaSpec.recommendedProperties.length;
  const recommendedPresent = recommendedTotal - missingRecommended.length;

  const validationScore = requiredTotal > 0
    ? Math.round((requiredValid / requiredTotal) * 100)
    : 100;

  const completenessScore = recommendedTotal > 0
    ? Math.round((recommendedPresent / recommendedTotal) * 100)
    : 100;

  const isValid = missingRequired.length === 0 && warnings.length === 0;

  return {
    type,
    id: typeof typed['@id'] === 'string' ? typed['@id'] : undefined,
    isValid,
    validationScore,
    completenessScore,
    requiredProperties,
    recommendedProperties,
    missingRequired,
    missingRecommended,
    warnings,
    suggestions,
    rawData: data,
  };
};

export const analyzeGraph = (data: object): GraphAnalysis | null => {
  const typed = data as Record<string, unknown>;

  if (!('@graph' in typed) || !Array.isArray(typed['@graph'])) {
    return null;
  }

  const graph = typed['@graph'] as object[];
  const nodes: GraphNode[] = [];
  const nodeIds = new Set<string>();
  const references = new Map<string, Set<string>>();

  // First pass: collect all node IDs
  for (const item of graph) {
    const itemTyped = item as Record<string, unknown>;
    const id = typeof itemTyped['@id'] === 'string' ? itemTyped['@id'] : null;
    if (id) {
      nodeIds.add(id);
      references.set(id, new Set());
    }
  }

  // Second pass: find references
  const findReferences = (obj: unknown, sourceId: string): void => {
    if (typeof obj !== 'object' || obj === null) return;

    if (Array.isArray(obj)) {
      for (const item of obj) {
        findReferences(item, sourceId);
      }
      return;
    }

    const record = obj as Record<string, unknown>;
    if ('@id' in record && typeof record['@id'] === 'string') {
      const targetId = record['@id'];
      if (nodeIds.has(targetId) && targetId !== sourceId) {
        references.get(sourceId)?.add(targetId);
      }
    }

    for (const value of Object.values(record)) {
      findReferences(value, sourceId);
    }
  };

  for (const item of graph) {
    const itemTyped = item as Record<string, unknown>;
    const id = typeof itemTyped['@id'] === 'string' ? itemTyped['@id'] : null;
    if (id) {
      findReferences(item, id);
    }
  }

  // Build nodes
  const referencedBy = new Map<string, Set<string>>();
  for (const [sourceId, targets] of references) {
    for (const targetId of targets) {
      if (!referencedBy.has(targetId)) {
        referencedBy.set(targetId, new Set());
      }
      referencedBy.get(targetId)?.add(sourceId);
    }
  }

  for (const item of graph) {
    const itemTyped = item as Record<string, unknown>;
    const id = typeof itemTyped['@id'] === 'string' ? itemTyped['@id'] : `_:node${nodes.length}`;
    const type = getSchemaType(item);

    nodes.push({
      id,
      type,
      references: Array.from(references.get(id) || []),
      referencedBy: Array.from(referencedBy.get(id) || []),
    });
  }

  // Find root and orphan nodes
  const rootNodes = nodes
    .filter(n => n.referencedBy.length === 0)
    .map(n => n.id);

  const orphanNodes = nodes
    .filter(n => n.referencedBy.length === 0 && n.references.length === 0)
    .map(n => n.id);

  // Detect circular references (simple check)
  const circularReferences: string[] = [];
  for (const node of nodes) {
    for (const ref of node.references) {
      const targetNode = nodes.find(n => n.id === ref);
      if (targetNode?.references.includes(node.id)) {
        const pair = [node.id, ref].sort().join(' <-> ');
        if (!circularReferences.includes(pair)) {
          circularReferences.push(pair);
        }
      }
    }
  }

  return {
    hasGraph: true,
    nodeCount: nodes.length,
    nodes,
    rootNodes,
    orphanNodes,
    circularReferences,
  };
};

export const calculateSchemaScore = (
  schemas: SchemaAnalysis[],
  graphAnalysis: GraphAnalysis | null
): SchemaValidationScore => {
  if (schemas.length === 0) {
    return { validation: 0, completeness: 0, coverage: 0, overall: 0 };
  }

  // Validation score (40 points max)
  const avgValidation = schemas.reduce((sum, s) => sum + s.validationScore, 0) / schemas.length;
  const validation = Math.round((avgValidation / 100) * 40);

  // Completeness score (35 points max)
  const avgCompleteness = schemas.reduce((sum, s) => sum + s.completenessScore, 0) / schemas.length;
  const completeness = Math.round((avgCompleteness / 100) * 35);

  // Coverage score (25 points max)
  const types = new Set(schemas.map(s => s.type));
  let coverage = 0;
  if (types.has('Organization') || types.has('LocalBusiness')) coverage += 8;
  if (types.has('BreadcrumbList')) coverage += 7;
  if (types.has('WebPage') || types.has('WebSite')) coverage += 5;
  if (schemas.some(s => ['Article', 'BlogPosting', 'NewsArticle', 'Product', 'Event'].includes(s.type))) {
    coverage += 5;
  }
  coverage = Math.min(coverage, 25);

  const overall = validation + completeness + coverage;

  return { validation, completeness, coverage, overall };
};

export const suggestMissingSchemas = (existingTypes: string[]): string[] => {
  const suggestions: string[] = [];
  const types = new Set(existingTypes);

  if (!types.has('Organization') && !types.has('LocalBusiness')) {
    suggestions.push('Add Organization or LocalBusiness schema for brand visibility');
  }
  if (!types.has('BreadcrumbList')) {
    suggestions.push('Add BreadcrumbList schema for enhanced navigation in search results');
  }
  if (!types.has('WebPage') && !types.has('WebSite')) {
    suggestions.push('Add WebPage or WebSite schema to define page structure');
  }

  return suggestions;
};
