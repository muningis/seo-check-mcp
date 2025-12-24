import { z } from 'zod/v3';
import type { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
// Dynamic imports to avoid loading WebDriver when not needed
const getRetrievePage = () => import('../page/mod').then(m => m.retrievePage);
const getRetrievePageWithoutScreenshots = () => import('../page/mod').then(m => m.retrievePageWithoutScreenshots);

export const registerScan = (server: McpServer): void => {
  server.registerTool('scan', {
    description: 'Comprehensive SEO analysis: metadata, content structure, images, links, Core Web Vitals, and optionally screenshots',
    inputSchema: {
      hostname: z.string().describe('Hostname with protocol, e.g. https://example.org'),
      url: z.string().describe('Full URL to scan'),
      includeScreenshots: z.boolean().optional().describe('Include desktop and mobile screenshots (default: false)'),
    },
  }, async ({ hostname, url, includeScreenshots = false }) => {
    console.error(`[scan] Starting for ${url}, includeScreenshots=${includeScreenshots}`);

    if (includeScreenshots) {
      const retrievePage = await getRetrievePage();
      const { pageInfo, desktopScreenshot, mobileScreenshot } = await retrievePage(hostname, url);
      return {
        content: [
          { type: 'text', text: JSON.stringify(pageInfo) },
          { type: 'image', data: desktopScreenshot, mimeType: 'image/png' },
          { type: 'image', data: mobileScreenshot, mimeType: 'image/png' },
        ]
      };
    } else {
      const retrievePageWithoutScreenshots = await getRetrievePageWithoutScreenshots();
      const pageInfo = await retrievePageWithoutScreenshots(hostname, url);
      console.error(`[scan] Done`);
      return {
        content: [
          { type: 'text', text: JSON.stringify(pageInfo) },
        ]
      };
    }
  });
};
