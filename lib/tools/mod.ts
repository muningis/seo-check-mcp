import type { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';

// Existing tools
import { registerReadSitemap } from './read-sitemap';
import { registerReadRobotsTxt } from './read-robots-txt';
import { registerScan } from './scan';

// Content analysis tools
import { registerAnalyzeContent } from './analyze-content';
import { registerCheckReadability } from './check-readability';

// Technical SEO tools
import { registerValidateSchema } from './validate-schema';
import { registerAnalyzeSitemap } from './analyze-sitemap';
import { registerCheckInternalLinks } from './check-internal-links';
import { registerFindBrokenLinks } from './find-broken-links';

// On-page optimization tools
import { registerAnalyzeMeta } from './analyze-meta';
import { registerAnalyzeHeadings } from './analyze-headings';
import { registerAnalyzeImages } from './analyze-images';
import { registerAnalyzeUrl } from './analyze-url';

// Competitive analysis tools
import { registerComparePages } from './compare-pages';
import { registerBenchmarkSeo } from './benchmark-seo';

// Debug tools
import { registerScanLite } from './scan-lite';

// Fix tools (actionable instructions for Claude Code)
import { registerFixMeta } from './fix-meta';
import { registerFixImages } from './fix-images';
import { registerFixHeadings } from './fix-headings';
import { registerFixSchema } from './fix-schema';
import { registerGenerateSeoTasks } from './generate-seo-tasks';
import { registerImproveContent } from './improve-content';

export const registerAllTools = (server: McpServer): void => {
  // Existing tools
  registerReadSitemap(server);
  registerReadRobotsTxt(server);
  registerScan(server);

  // Content analysis tools
  registerAnalyzeContent(server);
  registerCheckReadability(server);

  // Technical SEO tools
  registerValidateSchema(server);
  registerAnalyzeSitemap(server);
  registerCheckInternalLinks(server);
  registerFindBrokenLinks(server);

  // On-page optimization tools
  registerAnalyzeMeta(server);
  registerAnalyzeHeadings(server);
  registerAnalyzeImages(server);
  registerAnalyzeUrl(server);

  // Competitive analysis tools
  registerComparePages(server);
  registerBenchmarkSeo(server);

  // Debug tools
  registerScanLite(server);

  // Fix tools (actionable instructions for Claude Code)
  registerFixMeta(server);
  registerFixImages(server);
  registerFixHeadings(server);
  registerFixSchema(server);
  registerGenerateSeoTasks(server);
  registerImproveContent(server);
};

// Export individual registrations for selective use
export { registerReadSitemap } from './read-sitemap';
export { registerReadRobotsTxt } from './read-robots-txt';
export { registerScan } from './scan';
export { registerAnalyzeContent } from './analyze-content';
export { registerCheckReadability } from './check-readability';
export { registerValidateSchema } from './validate-schema';
export { registerAnalyzeSitemap } from './analyze-sitemap';
export { registerCheckInternalLinks } from './check-internal-links';
export { registerFindBrokenLinks } from './find-broken-links';
export { registerAnalyzeMeta } from './analyze-meta';
export { registerAnalyzeHeadings } from './analyze-headings';
export { registerAnalyzeImages } from './analyze-images';
export { registerAnalyzeUrl } from './analyze-url';
export { registerComparePages } from './compare-pages';
export { registerBenchmarkSeo } from './benchmark-seo';
export { registerFixMeta } from './fix-meta';
export { registerFixImages } from './fix-images';
export { registerFixHeadings } from './fix-headings';
export { registerFixSchema } from './fix-schema';
export { registerGenerateSeoTasks } from './generate-seo-tasks';
export { registerImproveContent } from './improve-content';
