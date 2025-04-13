import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { z } from "zod";
import { XMLParser } from "fast-xml-parser";
import { parse as parseHTML } from "node-html-parser";
import { driver } from "./browser/driver";
import { loadPage } from "./browser/load-page";

interface UrlSet {
  loc: string;
  lastmod: string;
  changefreq: string;
  priority: number;
}

interface MissingRequired {
  message: string;
}
interface MissingOptional {
  message: string;
}
const missingRequired = (name: string): MissingRequired => ({
  message: `${name} is required, but it's missing!`
})
const missingOptional = (name: string): MissingOptional => ({
  message: `${name} is advised, but it's missing!`
})

interface Resource {
  mime: string;
  url: string;
  headers: Record<string, string>;
}

interface PageInfo {
  headers: Record<string, string>;
  meta: {
    title: string | MissingRequired;
    description: string | MissingRequired;
    og: {
      title: string | MissingRequired;
      description: string | MissingRequired;
      image: string | MissingOptional;
    }
  }
  content: string;
  links?: string[];
  resources: Resource[];
  ldJson: object;
}

const parser = new XMLParser();

const server = new McpServer({
  name: "SEO Analysis",
  version: "1.0.0"
});

const USER_AGENT = 'MCP Seo Analysis (https://github.com/muningis.lt/seo-check-mcp)';
const HEADERS = { 'user-agent': USER_AGENT };

const RESOURCES_CACHE: Record<string, Resource> = {};
const retrieveResource = async (hostname: string, url: string): Promise<Resource> => {
const fullUrl = url.startsWith('/') ? `${hostname}/${url}` : url;
  if (fullUrl in RESOURCES_CACHE)
    return RESOURCES_CACHE[fullUrl]!;

  const res = await fetch(fullUrl, { headers: HEADERS });
  const headers = Object.fromEntries(res.headers.entries());
  const resource = {
    url: fullUrl,
    headers: headers,
    mime: (headers['Content-Type'] || headers['content-type']) ?? 'application/octet-stream'
  };

  RESOURCES_CACHE[fullUrl] = resource;

  return resource;
}

const retrieveResources = async (hostname: string, urls: string[]): Promise<Resource[]> => {
  return await Promise.all(urls.map(async url => await retrieveResource(hostname, url)));
}

const retrievePage = async (hostname: string, url: string): Promise<PageInfo> => {
  const res = await fetch(url, {
    headers: HEADERS
  });

  const html = await res.text();
  const dom = parseHTML(html);

  return {
    headers: Object.fromEntries(res.headers.entries()),
    meta: {
      title: dom.querySelector("title")?.innerText ?? missingRequired("title"),
      description: dom.querySelector("meta[name='description']")?.attributes.content ?? missingRequired("description"),
      og: {
        title: dom.querySelector("meta[property='og:title']")?.attributes.content ?? missingRequired("og:title"),
        description: dom.querySelector("meta[property='og:description']")?.attributes.content ?? missingRequired("og:description"),
        image: dom.querySelector("meta[property='og:image']")?.attributes.content ?? missingOptional("og:image"),
      }
    },
    content: dom.querySelector("body")?.innerHTML ?? '',
    links: dom.querySelectorAll("a")
      .filter(a => a.attributes.href?.startsWith(hostname))
      .map(a => {
        return a.attributes.href!
      }),
    ldJson: JSON.parse(dom.querySelector("script[type='application/ld+json']")?.innerText ?? '{}'),
    resources: await retrieveResources(hostname, [
      ...(dom.querySelectorAll("link[rel='stylesheet']")
        .map(stylesheet => stylesheet.attributes.href!)
        .filter(Boolean)),
      ...(dom.querySelectorAll("script[type='text/javascript']")
        .map(stylesheet => stylesheet.attributes.href!)
        .filter(Boolean)),
    ])
  }
}

server.tool("read-sitemap", {
  hostname: z.string().describe("Hostname of an url, including the protocol, eg. https://example.org"),
}, async ({ hostname }) => {
  const res = await fetch(`${hostname}/sitemap.xml`, { headers: HEADERS });
  const xml = await res.text();
  const data = parser.parse(xml);
  const urls = (data.urlset.url as UrlSet[]).map(url => url.loc);

  const response = { raw: xml, urls }

  return {
    content: [{
      type: "text",
      text: JSON.stringify(response)
    }]
  }
});

server.tool("read-robots-txt", {
  hostname: z.string().describe("Hostname of an url, including the protocol, eg. https://example.org"),
}, async ({ hostname }) => {
  const res = await fetch(`${hostname}/robots.txt`, { headers: HEADERS });
  const txt = await res.text();

  return {
    content: [{
      type: "text",
      text: txt
    }]
  }
});

server.tool("scan",
  {
    hostname: z.string().describe("Hostname of an url, including the protocol, eg. https://example.org"),
    url: z.string().describe("URL to scan")
  },
  async ({ hostname, url }) => {
    const info = retrievePage(hostname, url);

    const { screenshot: desktopScreenshot } = await loadPage(driver, url, {
      screenSize: {
        width: 1920,
        height: 1080
      }
    });
    
    const { screenshot: mobileScreenshot } = await loadPage(driver, url, {
      screenSize: {
        width: 375,
        height: 812
      }
    });

    return {
      content: [{
        type: "text",
        text: JSON.stringify(info)
      },{
        type: "image",
        data: desktopScreenshot,
        mimeType: 'image/png'
      }, {
        type: "image",
        data: mobileScreenshot,
        mimeType: 'image/png'
      }]
    }
  }
)

const transport = new StdioServerTransport();
await server.connect(transport);