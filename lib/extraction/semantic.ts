/**
 * Semantic HTML and ARIA attribute extraction
 */

import type { HTMLElement as NodeHTMLElement } from 'node-html-parser';
import type {
  LandmarkElements,
  SemanticElement,
  AriaInfo,
  AccessibilityIssue,
} from '../types/mod';

type ParsedDOM = {
  querySelector: (selector: string) => NodeHTMLElement | null;
  querySelectorAll: (selector: string) => NodeHTMLElement[];
};

const extractSemanticElement = (
  dom: ParsedDOM,
  tagName: string
): SemanticElement => {
  const elements = dom.querySelectorAll(tagName);
  return {
    tagName,
    count: elements.length,
    elements: elements.map((el) => ({
      hasId: !!el.attributes.id,
      hasAriaLabel: !!el.attributes['aria-label'],
      hasRole: !!el.attributes.role,
      textContent: el.textContent?.trim().substring(0, 100) || null,
    })),
  };
};

export const extractLandmarks = (dom: ParsedDOM): LandmarkElements => {
  return {
    main: extractSemanticElement(dom, 'main'),
    header: extractSemanticElement(dom, 'header'),
    footer: extractSemanticElement(dom, 'footer'),
    nav: extractSemanticElement(dom, 'nav'),
    aside: extractSemanticElement(dom, 'aside'),
    article: extractSemanticElement(dom, 'article'),
    section: extractSemanticElement(dom, 'section'),
  };
};

export const extractAriaInfo = (dom: ParsedDOM): AriaInfo => {
  const ariaLabels = dom.querySelectorAll('[aria-label]');
  const ariaLabelledBy = dom.querySelectorAll('[aria-labelledby]');
  const ariaDescribedBy = dom.querySelectorAll('[aria-describedby]');
  const ariaHidden = dom.querySelectorAll('[aria-hidden]');
  const ariaLive = dom.querySelectorAll('[aria-live]');
  const roles = dom.querySelectorAll('[role]');

  const roleDistribution: Record<string, number> = {};
  for (const el of roles) {
    const role = el.attributes.role;
    if (role) {
      roleDistribution[role] = (roleDistribution[role] || 0) + 1;
    }
  }

  return {
    ariaLabelCount: ariaLabels.length,
    ariaLabelledByCount: ariaLabelledBy.length,
    ariaDescribedByCount: ariaDescribedBy.length,
    roleCount: roles.length,
    roleDistribution,
    ariaHiddenCount: ariaHidden.length,
    ariaLiveCount: ariaLive.length,
  };
};

export const extractAccessibilityIssues = (
  dom: ParsedDOM
): AccessibilityIssue[] => {
  const issues: AccessibilityIssue[] = [];

  // WCAG 1.1.1: Images without alt text
  const images = dom.querySelectorAll('img');
  for (const img of images) {
    const alt = img.attributes.alt;
    const src = img.attributes.src || 'unknown';
    if (alt === undefined) {
      issues.push({
        wcagCriterion: '1.1.1',
        wcagLevel: 'A',
        element: 'img',
        selector: `img[src="${src.substring(0, 50)}"]`,
        issue: 'Image missing alt attribute',
        recommendation: 'Add alt attribute describing the image content, or alt="" for decorative images',
        impact: 'critical',
      });
    }
  }

  // WCAG 1.3.1: Form inputs without labels
  const inputs = dom.querySelectorAll('input:not([type="hidden"]):not([type="submit"]):not([type="button"]):not([type="reset"])');
  for (const input of inputs) {
    const id = input.attributes.id;
    const ariaLabel = input.attributes['aria-label'];
    const ariaLabelledBy = input.attributes['aria-labelledby'];
    const type = input.attributes.type || 'text';

    if (!ariaLabel && !ariaLabelledBy) {
      if (id) {
        const label = dom.querySelector(`label[for="${id}"]`);
        if (!label) {
          issues.push({
            wcagCriterion: '1.3.1',
            wcagLevel: 'A',
            element: 'input',
            selector: `input#${id}`,
            issue: `Input field (type="${type}") has id but no associated label`,
            recommendation: 'Add a <label for="..."> element or aria-label attribute',
            impact: 'serious',
          });
        }
      } else {
        issues.push({
          wcagCriterion: '1.3.1',
          wcagLevel: 'A',
          element: 'input',
          selector: `input[type="${type}"]`,
          issue: `Input field (type="${type}") has no id, label, or aria-label`,
          recommendation: 'Add id with associated label, or aria-label attribute',
          impact: 'serious',
        });
      }
    }
  }

  // WCAG 2.4.1: Check for skip link or main landmark
  const skipLink = dom.querySelector('a[href="#main"], a[href="#content"], a[href="#main-content"], .skip-link, .skip-to-content');
  const mainLandmark = dom.querySelector('main, [role="main"]');
  if (!skipLink && !mainLandmark) {
    issues.push({
      wcagCriterion: '2.4.1',
      wcagLevel: 'A',
      element: 'body',
      selector: 'body',
      issue: 'No skip link or main landmark found',
      recommendation: 'Add a <main> element or skip-to-content link for keyboard users',
      impact: 'moderate',
    });
  }

  // WCAG 2.4.4: Links with no text content
  const links = dom.querySelectorAll('a[href]');
  for (const link of links) {
    const text = link.textContent?.trim();
    const ariaLabel = link.attributes['aria-label'];
    const ariaLabelledBy = link.attributes['aria-labelledby'];
    const title = link.attributes.title;
    const hasImg = link.querySelector('img[alt]');
    const href = link.attributes.href || '';

    if (!text && !ariaLabel && !ariaLabelledBy && !hasImg && !title) {
      if (!href.startsWith('#') && !href.startsWith('javascript:')) {
        issues.push({
          wcagCriterion: '2.4.4',
          wcagLevel: 'A',
          element: 'a',
          selector: `a[href="${href.substring(0, 50)}"]`,
          issue: 'Link has no accessible text',
          recommendation: 'Add link text, aria-label, or image with alt text inside the link',
          impact: 'serious',
        });
      }
    }
  }

  // WCAG 4.1.2: Buttons without accessible names
  const buttons = dom.querySelectorAll('button');
  for (const button of buttons) {
    const text = button.textContent?.trim();
    const ariaLabel = button.attributes['aria-label'];
    const ariaLabelledBy = button.attributes['aria-labelledby'];
    const title = button.attributes.title;
    const hasImg = button.querySelector('img[alt]');

    if (!text && !ariaLabel && !ariaLabelledBy && !hasImg && !title) {
      issues.push({
        wcagCriterion: '4.1.2',
        wcagLevel: 'A',
        element: 'button',
        selector: 'button',
        issue: 'Button has no accessible name',
        recommendation: 'Add button text, aria-label, or image with alt text',
        impact: 'critical',
      });
    }
  }

  // WCAG 4.1.2: Input buttons without value
  const inputButtons = dom.querySelectorAll('input[type="submit"], input[type="button"], input[type="reset"]');
  for (const btn of inputButtons) {
    const value = btn.attributes.value;
    const ariaLabel = btn.attributes['aria-label'];
    const type = btn.attributes.type;

    if (!value && !ariaLabel) {
      issues.push({
        wcagCriterion: '4.1.2',
        wcagLevel: 'A',
        element: 'input',
        selector: `input[type="${type}"]`,
        issue: `Input button (type="${type}") has no value or aria-label`,
        recommendation: 'Add value attribute or aria-label',
        impact: 'critical',
      });
    }
  }

  return issues;
};
