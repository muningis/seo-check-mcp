import type { HTMLElement as NodeHTMLElement } from 'node-html-parser';
import type { MissingRequired, MissingOptional, PageMeta } from '../types/mod';
import { missingRequired, missingOptional } from './validation';

type ParsedDOM = { querySelector: (selector: string) => NodeHTMLElement | null };

export const getMetaContent = (
  dom: ParsedDOM,
  selector: string,
  required: boolean = false
): string | MissingRequired | MissingOptional => {
  const content = dom.querySelector(selector)?.attributes.content;
  if (content) return content;
  return required ? missingRequired(selector) : missingOptional(selector);
};

export const extractMeta = (dom: ParsedDOM): PageMeta => {
  const title = dom.querySelector("title")?.innerText;
  const description = dom.querySelector("meta[name='description']")?.attributes.content;
  const canonical = dom.querySelector("link[rel='canonical']")?.attributes.href;

  const charsetMeta = dom.querySelector("meta[charset]")?.attributes.charset;
  const contentTypeMeta = dom.querySelector("meta[http-equiv='Content-Type']")?.attributes.content;
  const charset = charsetMeta ?? (contentTypeMeta?.match(/charset=([^;]+)/)?.[1]) ?? null;

  return {
    charset: charset ?? missingRequired("charset"),
    viewport: getMetaContent(dom, "meta[name='viewport']", true),
    lang: dom.querySelector("html")?.attributes.lang ?? missingOptional("lang attribute"),

    title: title ?? missingRequired("title"),
    titleLength: title?.length ?? 0,
    description: description ?? missingRequired("description"),
    descriptionLength: description?.length ?? 0,
    canonical: canonical ?? missingOptional("canonical"),
    robots: getMetaContent(dom, "meta[name='robots']", false),

    og: {
      title: getMetaContent(dom, "meta[property='og:title']", true),
      description: getMetaContent(dom, "meta[property='og:description']", true),
      image: getMetaContent(dom, "meta[property='og:image']", false),
      url: getMetaContent(dom, "meta[property='og:url']", false),
      type: getMetaContent(dom, "meta[property='og:type']", false),
      siteName: getMetaContent(dom, "meta[property='og:site_name']", false),
    },

    twitter: {
      card: getMetaContent(dom, "meta[name='twitter:card']", false),
      title: getMetaContent(dom, "meta[name='twitter:title']", false),
      description: getMetaContent(dom, "meta[name='twitter:description']", false),
      image: getMetaContent(dom, "meta[name='twitter:image']", false),
      site: getMetaContent(dom, "meta[name='twitter:site']", false),
    },

    mobile: {
      themeColor: getMetaContent(dom, "meta[name='theme-color']", false),
      appleMobileWebAppCapable: getMetaContent(dom, "meta[name='apple-mobile-web-app-capable']", false),
    },
  };
};
