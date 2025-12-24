import { z } from 'zod/v3';
import { parse as parseHTML } from 'node-html-parser';
import type { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { DEFAULT_HEADERS } from '../config/mod';
import { extractLdJson, extractMeta } from '../extraction/mod';
import type { ActionableInstruction, FixResult } from '../types/mod';

// Schema templates for common page types
const SCHEMA_TEMPLATES: Record<string, (url: string, title: string, description: string) => object> = {
  WebPage: (url, title, description) => ({
    '@context': 'https://schema.org',
    '@type': 'WebPage',
    name: title,
    description: description,
    url: url,
  }),
  WebSite: (url, title, description) => ({
    '@context': 'https://schema.org',
    '@type': 'WebSite',
    name: title,
    description: description,
    url: new URL(url).origin,
    potentialAction: {
      '@type': 'SearchAction',
      target: `${new URL(url).origin}/search?q={search_term_string}`,
      'query-input': 'required name=search_term_string',
    },
  }),
  Organization: (url, title, _description) => ({
    '@context': 'https://schema.org',
    '@type': 'Organization',
    name: title.split(/[-|]/)[0]?.trim() || title,
    url: new URL(url).origin,
    logo: `${new URL(url).origin}/logo.png`,
  }),
  Article: (url, title, description) => ({
    '@context': 'https://schema.org',
    '@type': 'Article',
    headline: title,
    description: description,
    url: url,
    datePublished: new Date().toISOString().split('T')[0],
    author: {
      '@type': 'Person',
      name: 'Author Name',
    },
    publisher: {
      '@type': 'Organization',
      name: 'Publisher Name',
      logo: {
        '@type': 'ImageObject',
        url: `${new URL(url).origin}/logo.png`,
      },
    },
  }),
  BreadcrumbList: (url, _title, _description) => {
    const urlObj = new URL(url);
    const pathParts = urlObj.pathname.split('/').filter(Boolean);
    const items = [
      {
        '@type': 'ListItem',
        position: 1,
        name: 'Home',
        item: urlObj.origin,
      },
    ];
    let currentPath = '';
    pathParts.forEach((part, index) => {
      currentPath += `/${part}`;
      items.push({
        '@type': 'ListItem',
        position: index + 2,
        name: part.charAt(0).toUpperCase() + part.slice(1).replace(/-/g, ' '),
        item: `${urlObj.origin}${currentPath}`,
      });
    });
    return {
      '@context': 'https://schema.org',
      '@type': 'BreadcrumbList',
      itemListElement: items,
    };
  },
  FAQPage: (_url, _title, _description) => ({
    '@context': 'https://schema.org',
    '@type': 'FAQPage',
    mainEntity: [
      {
        '@type': 'Question',
        name: 'Your question here?',
        acceptedAnswer: {
          '@type': 'Answer',
          text: 'Your answer here.',
        },
      },
    ],
  }),
};

export const registerFixSchema = (server: McpServer): void => {
  server.registerTool('fix-schema', {
    description: 'Returns actionable instructions for JSON-LD structured data fixes with ready-to-use schema templates',
    inputSchema: {
      url: z.string().describe('Full URL to analyze'),
      schemaType: z.string().optional().describe('Specific schema type to suggest (WebPage, Article, Organization, BreadcrumbList, FAQPage)'),
    },
  }, async ({ url, schemaType }) => {
    const res = await fetch(url, { headers: DEFAULT_HEADERS });
    const html = await res.text();
    const dom = parseHTML(html);

    const ldJsonData = extractLdJson(dom);
    const meta = extractMeta(dom);
    const title = typeof meta.title === 'string' ? meta.title : 'Page Title';
    const description = typeof meta.description === 'string' ? meta.description : 'Page description';

    const instructions: ActionableInstruction[] = [];
    const existingTypes = new Set<string>();

    // Analyze existing schemas
    for (const data of ldJsonData) {
      const type = getSchemaType(data);
      existingTypes.add(type);

      // Check for issues in existing schemas
      if (type !== 'Unknown') {
        const issues = validateSchema(data, type);
        for (const issue of issues) {
          instructions.push({
            action: 'update',
            target: {
              type: 'html-tag',
              selector: `script[type="application/ld+json"]:has-text("${type}")`,
            },
            value: {
              current: issue.current,
              suggested: issue.suggested,
            },
            reason: issue.reason,
            priority: issue.priority,
            automated: false,
          });
        }
      }
    }

    // If specific schema type requested
    if (schemaType && SCHEMA_TEMPLATES[schemaType] && !existingTypes.has(schemaType)) {
      const template = SCHEMA_TEMPLATES[schemaType](url, title, description);
      instructions.push({
        action: 'add',
        target: { type: 'html-tag', selector: 'head', tagName: 'script' },
        value: {
          suggested: `<script type="application/ld+json">\n${JSON.stringify(template, null, 2)}\n</script>`,
        },
        reason: `Adding ${schemaType} schema to improve rich results in search.`,
        priority: 'medium',
        automated: true,
      });
    }

    // Suggest missing essential schemas
    if (ldJsonData.length === 0) {
      // No schema at all - suggest WebPage as minimum
      const webPageTemplate = SCHEMA_TEMPLATES.WebPage!(url, title, description);
      instructions.push({
        action: 'add',
        target: { type: 'html-tag', selector: 'head', tagName: 'script' },
        value: {
          suggested: `<script type="application/ld+json">\n${JSON.stringify(webPageTemplate, null, 2)}\n</script>`,
        },
        reason: 'No structured data found. Adding WebPage schema as minimum for SEO.',
        priority: 'high',
        automated: true,
      });
    } else {
      // Suggest missing essential schemas
      if (!existingTypes.has('Organization') && !existingTypes.has('LocalBusiness')) {
        const orgTemplate = SCHEMA_TEMPLATES.Organization!(url, title, description);
        instructions.push({
          action: 'add',
          target: { type: 'html-tag', selector: 'head', tagName: 'script' },
          value: {
            suggested: `<script type="application/ld+json">\n${JSON.stringify(orgTemplate, null, 2)}\n</script>`,
          },
          reason: 'Adding Organization schema improves brand visibility in search.',
          priority: 'medium',
          automated: true,
        });
      }

      if (!existingTypes.has('BreadcrumbList')) {
        const breadcrumbTemplate = SCHEMA_TEMPLATES.BreadcrumbList!(url, title, description);
        instructions.push({
          action: 'add',
          target: { type: 'html-tag', selector: 'head', tagName: 'script' },
          value: {
            suggested: `<script type="application/ld+json">\n${JSON.stringify(breadcrumbTemplate, null, 2)}\n</script>`,
          },
          reason: 'Adding BreadcrumbList schema enables breadcrumb display in search results.',
          priority: 'low',
          automated: true,
        });
      }
    }

    // Summary
    const criticalCount = instructions.filter(i => i.priority === 'critical').length;
    const highCount = instructions.filter(i => i.priority === 'high').length;
    const mediumCount = instructions.filter(i => i.priority === 'medium').length;
    const lowCount = instructions.filter(i => i.priority === 'low').length;

    const summaryParts = [];
    if (criticalCount) summaryParts.push(`${criticalCount} critical`);
    if (highCount) summaryParts.push(`${highCount} high`);
    if (mediumCount) summaryParts.push(`${mediumCount} medium`);
    if (lowCount) summaryParts.push(`${lowCount} low`);

    const result: FixResult = {
      url,
      instructions,
      summary: summaryParts.length > 0
        ? `${instructions.length} schema fixes: ${summaryParts.join(', ')} priority`
        : 'Structured data looks good',
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

interface SchemaIssue {
  current: string;
  suggested: string;
  reason: string;
  priority: 'critical' | 'high' | 'medium' | 'low';
}

function validateSchema(data: object, type: string): SchemaIssue[] {
  const issues: SchemaIssue[] = [];
  const typed = data as Record<string, unknown>;

  // Check for missing @context
  if (!('@context' in typed)) {
    issues.push({
      current: JSON.stringify(data).substring(0, 50) + '...',
      suggested: '{"@context": "https://schema.org", ...}',
      reason: 'Missing @context property. Schema.org context is required.',
      priority: 'high',
    });
  }

  // Check image URLs are absolute
  if ('image' in typed) {
    const image = typed.image;
    if (typeof image === 'string' && !image.startsWith('http')) {
      issues.push({
        current: `"image": "${image}"`,
        suggested: `"image": "https://yourdomain.com${image.startsWith('/') ? '' : '/'}${image}"`,
        reason: 'Image URL should be absolute (start with https://).',
        priority: 'medium',
      });
    }
  }

  // Check datePublished format
  if ('datePublished' in typed) {
    const date = typed.datePublished;
    if (typeof date === 'string' && !/^\d{4}-\d{2}-\d{2}/.test(date)) {
      issues.push({
        current: `"datePublished": "${date}"`,
        suggested: `"datePublished": "${new Date().toISOString().split('T')[0]}"`,
        reason: 'datePublished should be in ISO 8601 format (YYYY-MM-DD).',
        priority: 'medium',
      });
    }
  }

  // Type-specific checks
  const requiredProps: Record<string, string[]> = {
    Article: ['headline', 'author', 'datePublished'],
    Product: ['name'],
    Organization: ['name'],
    WebPage: ['name'],
  };

  const required = requiredProps[type];
  if (required) {
    for (const prop of required) {
      if (!(prop in typed)) {
        issues.push({
          current: `Missing "${prop}"`,
          suggested: `Add "${prop}" property to ${type} schema`,
          reason: `${prop} is required for ${type} schema to be valid.`,
          priority: 'high',
        });
      }
    }
  }

  return issues;
}
