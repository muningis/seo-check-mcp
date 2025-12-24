import { z } from 'zod/v3';
import { parse as parseHTML } from 'node-html-parser';
import type { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { DEFAULT_HEADERS } from '../config/mod';
import { extractLdJson } from '../extraction/mod';

interface SchemaType {
  requiredProperties: string[];
  recommendedProperties: string[];
}

const SCHEMA_TYPES: Record<string, SchemaType> = {
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
};

interface SchemaValidationResult {
  url: string;
  schemasFound: number;
  schemas: Array<{
    type: string;
    isValid: boolean;
    missingRequired: string[];
    missingRecommended: string[];
    warnings: string[];
    suggestions: string[];
    rawData: object;
  }>;
  generalSuggestions: string[];
}

export const registerValidateSchema = (server: McpServer): void => {
  server.registerTool('validate-schema', {
    description: 'Validate structured data (Schema.org/JSON-LD) with required property checks and enhancement suggestions',
    inputSchema: {
      url: z.string().describe('Full URL to analyze'),
    },
  }, async ({ url }) => {
    const res = await fetch(url, { headers: DEFAULT_HEADERS });
    const html = await res.text();
    const dom = parseHTML(html);

    const ldJsonData = extractLdJson(dom);
    const generalSuggestions: string[] = [];

    if (ldJsonData.length === 0) {
      generalSuggestions.push('No structured data found. Add JSON-LD markup to help search engines understand your content.');
      generalSuggestions.push('Consider adding: Organization, WebPage, and BreadcrumbList schemas as a minimum.');
    }

    const schemas = ldJsonData.map(data => {
      const type = getSchemaType(data);
      const missingRequired: string[] = [];
      const missingRecommended: string[] = [];
      const warnings: string[] = [];
      const suggestions: string[] = [];

      if (type === 'Unknown') {
        warnings.push('Schema type not recognized or missing @type property');
        return {
          type,
          isValid: false,
          missingRequired,
          missingRecommended,
          warnings,
          suggestions: ['Add a valid @type property from Schema.org vocabulary'],
          rawData: data,
        };
      }

      const schemaSpec = SCHEMA_TYPES[type];
      if (schemaSpec) {
        // Check required properties
        for (const prop of schemaSpec.requiredProperties) {
          if (!hasProperty(data, prop)) {
            missingRequired.push(prop);
          }
        }

        // Check recommended properties
        for (const prop of schemaSpec.recommendedProperties) {
          if (!hasProperty(data, prop)) {
            missingRecommended.push(prop);
          }
        }
      }

      // Common validations
      if (hasProperty(data, 'image')) {
        const image = (data as Record<string, unknown>)['image'];
        if (typeof image === 'string' && !image.startsWith('http')) {
          warnings.push('Image URL should be absolute (start with https://)');
        }
      }

      if (hasProperty(data, 'url')) {
        const urlProp = (data as Record<string, unknown>)['url'];
        if (typeof urlProp === 'string' && urlProp !== url) {
          warnings.push('Schema URL does not match page URL');
        }
      }

      if (hasProperty(data, 'datePublished')) {
        const date = (data as Record<string, unknown>)['datePublished'];
        if (typeof date === 'string' && !isValidISODate(date)) {
          warnings.push('datePublished should be in ISO 8601 format (YYYY-MM-DD)');
        }
      }

      // Generate suggestions
      if (missingRequired.length > 0) {
        suggestions.push(`Add required properties: ${missingRequired.join(', ')}`);
      }

      if (missingRecommended.length > 0 && missingRecommended.length <= 3) {
        suggestions.push(`Consider adding: ${missingRecommended.join(', ')}`);
      } else if (missingRecommended.length > 3) {
        suggestions.push(`Consider adding recommended properties to enhance rich results`);
      }

      const isValid = missingRequired.length === 0 && warnings.length === 0;

      return {
        type,
        isValid,
        missingRequired,
        missingRecommended,
        warnings,
        suggestions,
        rawData: data,
      };
    });

    // General suggestions based on what's missing
    const foundTypes = new Set(schemas.map(s => s.type));

    if (!foundTypes.has('Organization') && !foundTypes.has('LocalBusiness')) {
      generalSuggestions.push('Add Organization or LocalBusiness schema for brand visibility');
    }

    if (!foundTypes.has('BreadcrumbList')) {
      generalSuggestions.push('Add BreadcrumbList schema for enhanced navigation display in search results');
    }

    if (!foundTypes.has('WebPage') && !foundTypes.has('WebSite')) {
      generalSuggestions.push('Add WebPage or WebSite schema to define page structure');
    }

    const result: SchemaValidationResult = {
      url,
      schemasFound: ldJsonData.length,
      schemas,
      generalSuggestions,
    };

    return {
      content: [{
        type: 'text',
        text: JSON.stringify(result, null, 2),
      }],
    };
  });
};

function getSchemaType(data: object): string {
  const typed = data as Record<string, unknown>;

  if ('@type' in typed) {
    const type = typed['@type'];
    if (typeof type === 'string') return type;
    if (Array.isArray(type) && type.length > 0) return String(type[0]);
  }

  if ('@graph' in typed && Array.isArray(typed['@graph'])) {
    const graph = typed['@graph'] as object[];
    const first = graph[0];
    if (graph.length > 0 && first) return getSchemaType(first);
  }

  return 'Unknown';
}

function hasProperty(data: object, prop: string): boolean {
  const typed = data as Record<string, unknown>;

  if (prop in typed) return true;

  if ('@graph' in typed && Array.isArray(typed['@graph'])) {
    return typed['@graph'].some((item: object) => hasProperty(item, prop));
  }

  return false;
}

function isValidISODate(date: string): boolean {
  return /^\d{4}-\d{2}-\d{2}(T\d{2}:\d{2}:\d{2})?/.test(date);
}
