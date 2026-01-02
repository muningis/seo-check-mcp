import { z } from 'zod/v3';
import { parse as parseHTML } from 'node-html-parser';
import type { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { DEFAULT_HEADERS } from '../config/mod';
import { extractLdJson } from '../extraction/mod';
import {
  analyzeSchema,
  analyzeGraph,
  calculateSchemaScore,
  suggestMissingSchemas,
} from '../analysis/mod';
import type { SchemaValidationResult, SchemaAnalysis } from '../types/mod';

export const registerValidateSchema = (server: McpServer): void => {
  server.registerTool('validate-schema', {
    description: 'Validate structured data (Schema.org/JSON-LD) with @graph analysis, completeness scoring, and enhancement suggestions',
    inputSchema: {
      url: z.string().describe('Full URL to analyze'),
      verbose: z.boolean().optional().describe('Include raw schema data in output (default: false)'),
    },
  }, async ({ url, verbose = false }) => {
    const res = await fetch(url, { headers: DEFAULT_HEADERS });
    const html = await res.text();
    const dom = parseHTML(html);

    const ldJsonData = extractLdJson(dom);
    const generalSuggestions: string[] = [];

    if (ldJsonData.length === 0) {
      generalSuggestions.push('No structured data found. Add JSON-LD markup to help search engines understand your content.');
      generalSuggestions.push('Consider adding: Organization, WebPage, and BreadcrumbList schemas as a minimum.');

      const result: SchemaValidationResult = {
        url,
        schemasFound: 0,
        schemas: [],
        graphAnalysis: null,
        score: { validation: 0, completeness: 0, coverage: 0, overall: 0 },
        generalSuggestions,
        recommendedSchemas: ['Organization', 'WebPage', 'BreadcrumbList'],
      };

      return {
        content: [{
          type: 'text',
          text: JSON.stringify(result, null, 2),
        }],
      };
    }

    // Analyze each schema
    const schemas: SchemaAnalysis[] = [];
    let graphAnalysis = null;

    for (const data of ldJsonData) {
      // Check for @graph structure
      const typed = data as Record<string, unknown>;
      if ('@graph' in typed && Array.isArray(typed['@graph'])) {
        graphAnalysis = analyzeGraph(data);
        // Analyze each item in the graph
        for (const item of typed['@graph'] as object[]) {
          const analysis = analyzeSchema(item);
          if (!verbose) {
            // Remove raw data if not verbose
            delete analysis.rawData;
          }
          schemas.push(analysis);
        }
      } else {
        const analysis = analyzeSchema(data);
        if (!verbose) {
          delete analysis.rawData;
        }
        schemas.push(analysis);
      }
    }

    // Calculate overall score
    const score = calculateSchemaScore(schemas, graphAnalysis);

    // Generate suggestions for missing schemas
    const existingTypes = schemas.map(s => s.type);
    const recommendedSchemas = suggestMissingSchemas(existingTypes);
    generalSuggestions.push(...recommendedSchemas);

    // Add graph-specific suggestions
    if (graphAnalysis) {
      if (graphAnalysis.orphanNodes.length > 0) {
        generalSuggestions.push(
          `${graphAnalysis.orphanNodes.length} orphan node(s) in @graph - consider linking them with @id references`
        );
      }
      if (graphAnalysis.circularReferences.length > 0) {
        generalSuggestions.push(
          `Circular references detected: ${graphAnalysis.circularReferences.join(', ')}`
        );
      }
    }

    const result: SchemaValidationResult = {
      url,
      schemasFound: schemas.length,
      schemas,
      graphAnalysis,
      score,
      generalSuggestions,
      recommendedSchemas: existingTypes.length < 3
        ? ['Organization', 'BreadcrumbList', 'WebPage'].filter(t => !existingTypes.includes(t))
        : [],
    };

    return {
      content: [{
        type: 'text',
        text: JSON.stringify(result, null, 2),
      }],
    };
  });
};
