import { z } from 'zod/v3';
import { XMLParser } from 'fast-xml-parser';
import type { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import type { UrlSet } from '../types/mod';
import { DEFAULT_HEADERS } from '../config/mod';

const xmlParser = new XMLParser();

export const registerReadSitemap = (server: McpServer): void => {
  // @ts-ignore - Deep type instantiation with Zod/MCP SDK
  server.registerTool('read-sitemap', {
    description: 'Read and parse the XML sitemap of a website',
    inputSchema: {
      hostname: z.string().describe('Hostname with protocol, e.g. https://example.org'),
    },
  }, async ({ hostname }) => {
    const res = await fetch(`${hostname}/sitemap.xml`, { headers: DEFAULT_HEADERS });
    const xml = await res.text();
    const data = xmlParser.parse(xml);
    const urls = (data.urlset?.url as UrlSet[] | undefined)?.map(u => u.loc) ?? [];

    return {
      content: [{
        type: 'text',
        text: JSON.stringify({ raw: xml, urls })
      }]
    };
  });
};
