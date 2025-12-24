import { z } from 'zod/v3';
import type { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { DEFAULT_HEADERS } from '../config/mod';

export const registerReadRobotsTxt = (server: McpServer): void => {
  server.registerTool('read-robots-txt', {
    description: 'Read the robots.txt file of a website',
    inputSchema: {
      hostname: z.string().describe('Hostname with protocol, e.g. https://example.org'),
    },
  }, async ({ hostname }) => {
    const res = await fetch(`${hostname}/robots.txt`, { headers: DEFAULT_HEADERS });
    const txt = await res.text();

    return {
      content: [{
        type: 'text',
        text: txt
      }]
    };
  });
};
