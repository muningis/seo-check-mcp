#!/usr/bin/env bun
/**
 * SEO Analysis MCP Server - Stdio version for Claude Desktop
 *
 * This is the entry point for Claude Desktop which uses stdio transport.
 * For HTTP-based clients, use server.mts instead.
 */

import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import { registerAllTools } from './lib/tools/mod';
import { SERVER_VERSION, SERVER_NAME } from './lib/config/mod';

// =============================================================================
// MCP Server Setup
// =============================================================================

const server = new McpServer({
  name: SERVER_NAME,
  version: SERVER_VERSION
});

registerAllTools(server);

// =============================================================================
// Stdio Transport (for Claude Desktop)
// =============================================================================

const transport = new StdioServerTransport();

server.connect(transport).then(() => {
  console.error(`${SERVER_NAME} MCP Server v${SERVER_VERSION} started (stdio mode)`);
});

// =============================================================================
// Graceful Shutdown
// =============================================================================

const shutdown = async () => {
  console.error('Shutting down...');
  try {
    // Dynamically import to avoid loading WebDriver if not used
    const { quitDriver } = await import('./browser/driver');
    await quitDriver();
  } catch {
    // Ignore errors during shutdown
  }
  process.exit(0);
};

process.on('SIGINT', shutdown);
process.on('SIGTERM', shutdown);
