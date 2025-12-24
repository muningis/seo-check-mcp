import type { HTMLElement as NodeHTMLElement } from 'node-html-parser';
import type { HeadingData } from '../types/mod';

type ParsedDOM = { querySelector: (selector: string) => NodeHTMLElement | null; querySelectorAll: (selector: string) => NodeHTMLElement[] };

export const extractHeadingData = (dom: ParsedDOM, tag: string): HeadingData => {
  const elements = dom.querySelectorAll(tag);
  return {
    count: elements.length,
    texts: elements.map(el => el.textContent.trim()).filter(Boolean),
  };
};

export const calculateWordCount = (dom: ParsedDOM): number => {
  const body = dom.querySelector('body');
  if (!body) return 0;
  const textContent = body.textContent;
  return textContent.split(/\s+/).filter(word => word.trim().length > 0).length;
};

export const extractLdJson = (dom: ParsedDOM): object[] => {
  const scripts = dom.querySelectorAll("script[type='application/ld+json']");
  return scripts.map(script => {
    try {
      return JSON.parse(script.innerText);
    } catch {
      return { error: 'Invalid JSON', raw: script.innerText };
    }
  });
};
