import { z } from 'zod/v3';
import { parse as parseHTML } from 'node-html-parser';
import type { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { DEFAULT_HEADERS } from '../config/mod';
import { headersToRecord, extractMeta } from '../extraction/mod';

/**
 * Minimal scan tool for debugging - no WebDriver, no complex extraction
 */
export const registerScanLite = (server: McpServer): void => {
  server.registerTool('scan-lite', {
    description: 'Lightweight page scan - just meta tags, no screenshots',
    inputSchema: {
      url: z.string().describe('Full URL to scan'),
    },
  }, async ({ url }) => {
    console.error(`[scan-lite] Fetching ${url}`);

    const res = await fetch(url, { headers: DEFAULT_HEADERS });
    const html = await res.text();
    const dom = parseHTML(html);
    const headers = headersToRecord(res.headers);
    const meta = extractMeta(dom);

    console.error(`[scan-lite] Done`);

    return {
      content: [
        { type: 'text', text: JSON.stringify({ headers, meta }, null, 2) },
      ]
    };
  });
};
