import type { HTMLElement as NodeHTMLElement } from 'node-html-parser';
import type { ImageInfo, ImageStats } from '../types/mod';

type ParsedDOM = { querySelectorAll: (selector: string) => NodeHTMLElement[] };

export const extractImages = (dom: ParsedDOM): ImageStats => {
  const images = dom.querySelectorAll('img');
  const details: ImageInfo[] = images.map(img => ({
    src: img.attributes.src ?? '',
    alt: img.attributes.alt ?? null,
    width: img.attributes.width ?? null,
    height: img.attributes.height ?? null,
  }));

  const withAlt = details.filter(img => img.alt !== null && img.alt.trim() !== '').length;

  return {
    total: images.length,
    withAlt,
    withoutAlt: images.length - withAlt,
    details,
  };
};
