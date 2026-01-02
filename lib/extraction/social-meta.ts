/**
 * Extended social media meta tag extraction
 */

import type { HTMLElement as NodeHTMLElement } from 'node-html-parser';
import type {
  OpenGraphData,
  TwitterCardData,
  TwitterCardType,
  FacebookData,
} from '../types/mod';

type ParsedDOM = {
  querySelector: (selector: string) => NodeHTMLElement | null;
  querySelectorAll: (selector: string) => NodeHTMLElement[];
};

const getMetaContent = (dom: ParsedDOM, selector: string): string | null => {
  return dom.querySelector(selector)?.attributes.content || null;
};

const parseNumber = (value: string | null): number | null => {
  if (!value) return null;
  const num = parseInt(value, 10);
  return isNaN(num) ? null : num;
};

export const extractOpenGraph = (dom: ParsedDOM): OpenGraphData => {
  const localeAlternates: string[] = [];
  const altLocales = dom.querySelectorAll("meta[property='og:locale:alternate']");
  for (const meta of altLocales) {
    const content = meta.attributes.content;
    if (content) localeAlternates.push(content);
  }

  return {
    title: getMetaContent(dom, "meta[property='og:title']"),
    description: getMetaContent(dom, "meta[property='og:description']"),
    image: getMetaContent(dom, "meta[property='og:image']"),
    imageWidth: parseNumber(getMetaContent(dom, "meta[property='og:image:width']")),
    imageHeight: parseNumber(getMetaContent(dom, "meta[property='og:image:height']")),
    imageAlt: getMetaContent(dom, "meta[property='og:image:alt']"),
    url: getMetaContent(dom, "meta[property='og:url']"),
    type: getMetaContent(dom, "meta[property='og:type']"),
    siteName: getMetaContent(dom, "meta[property='og:site_name']"),
    locale: getMetaContent(dom, "meta[property='og:locale']"),
    localeAlternates,
    video: getMetaContent(dom, "meta[property='og:video']"),
    audio: getMetaContent(dom, "meta[property='og:audio']"),
  };
};

const VALID_TWITTER_CARDS: TwitterCardType[] = ['summary', 'summary_large_image', 'app', 'player'];

export const extractTwitterCard = (dom: ParsedDOM): TwitterCardData => {
  const cardValue = getMetaContent(dom, "meta[name='twitter:card']");
  const card = cardValue && VALID_TWITTER_CARDS.includes(cardValue as TwitterCardType)
    ? (cardValue as TwitterCardType)
    : null;

  return {
    card,
    title: getMetaContent(dom, "meta[name='twitter:title']"),
    description: getMetaContent(dom, "meta[name='twitter:description']"),
    image: getMetaContent(dom, "meta[name='twitter:image']"),
    imageAlt: getMetaContent(dom, "meta[name='twitter:image:alt']"),
    site: getMetaContent(dom, "meta[name='twitter:site']"),
    siteId: getMetaContent(dom, "meta[name='twitter:site:id']"),
    creator: getMetaContent(dom, "meta[name='twitter:creator']"),
    creatorId: getMetaContent(dom, "meta[name='twitter:creator:id']"),
    player: getMetaContent(dom, "meta[name='twitter:player']"),
    playerWidth: parseNumber(getMetaContent(dom, "meta[name='twitter:player:width']")),
    playerHeight: parseNumber(getMetaContent(dom, "meta[name='twitter:player:height']")),
  };
};

export const extractFacebookMeta = (dom: ParsedDOM): FacebookData => {
  return {
    appId: getMetaContent(dom, "meta[property='fb:app_id']"),
    pages: getMetaContent(dom, "meta[property='fb:pages']"),
    admins: getMetaContent(dom, "meta[property='fb:admins']"),
  };
};
