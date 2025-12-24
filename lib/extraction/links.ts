import type { HTMLElement as NodeHTMLElement } from 'node-html-parser';
import type { LinkInfo, PageLinks } from '../types/mod';

type ParsedDOM = { querySelectorAll: (selector: string) => NodeHTMLElement[] };

export const extractLinks = (dom: ParsedDOM, hostname: string): PageLinks => {
  const allLinks = dom.querySelectorAll('a[href]');

  const mapLink = (a: NodeHTMLElement): LinkInfo => ({
    href: a.attributes.href!,
    text: a.textContent.trim(),
    rel: a.attributes.rel ?? null,
    target: a.attributes.target ?? null,
  });

  const internal: LinkInfo[] = [];
  const external: LinkInfo[] = [];

  allLinks.forEach(a => {
    const href = a.attributes.href;
    if (!href) return;

    if (href.startsWith('mailto:') || href.startsWith('tel:') ||
        href.startsWith('javascript:') || href.startsWith('#')) {
      return;
    }

    if (href.startsWith('/') || href.startsWith(hostname)) {
      internal.push(mapLink(a));
    } else if (href.startsWith('http://') || href.startsWith('https://')) {
      external.push(mapLink(a));
    }
  });

  return { internal, external };
};
