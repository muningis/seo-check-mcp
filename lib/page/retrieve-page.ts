import { parse as parseHTML } from 'node-html-parser';
import type { RetrievePageResult, PageInfo } from '../types/mod';
import {
  headersToRecord,
  extractSecurityHeaders,
  extractMeta,
  calculateWordCount,
  extractHeadingData,
  extractImages,
  extractLinks,
  extractLdJson,
} from '../extraction/mod';
import { retrieveResources } from '../cache/mod';
import { DEFAULT_HEADERS, SCREEN_SIZES } from '../config/mod';
import { loadPage } from '../../browser/load-page';
import { getDriver, releaseDriver } from '../../browser/driver';

/**
 * Retrieve page info without screenshots (no WebDriver needed)
 */
export const retrievePageWithoutScreenshots = async (
  hostname: string,
  url: string
): Promise<PageInfo> => {
  console.error(`[retrievePageWithoutScreenshots] Starting for ${url}`);

  const res = await fetch(url, { headers: DEFAULT_HEADERS });
  const html = await res.text();
  const dom = parseHTML(html);
  const headers = headersToRecord(res.headers);

  return {
    headers,
    securityHeaders: extractSecurityHeaders(headers),
    meta: extractMeta(dom),
    content: {
      html: dom.querySelector("body")?.innerHTML ?? '',
      wordCount: calculateWordCount(dom),
      headings: {
        h1: extractHeadingData(dom, 'h1'),
        h2: extractHeadingData(dom, 'h2'),
        h3: extractHeadingData(dom, 'h3'),
        h4: extractHeadingData(dom, 'h4'),
        h5: extractHeadingData(dom, 'h5'),
        h6: extractHeadingData(dom, 'h6'),
      },
    },
    images: extractImages(dom),
    links: extractLinks(dom, hostname),
    ldJson: extractLdJson(dom),
    resources: await retrieveResources(hostname, [
      ...(dom.querySelectorAll("link[rel='stylesheet']")
        .map(s => s.attributes.href!)
        .filter(Boolean)),
      ...(dom.querySelectorAll("script[src]")
        .map(s => s.attributes.src!)
        .filter(Boolean)),
    ], DEFAULT_HEADERS),
    vitalMetrics: {
      timeToFirstByteMS: 0,
      loadCompleteMS: 0,
      domInteractiveMS: 0,
      domContentLoadedMS: 0,
      coreWebVitals: { lcp: null, cls: null, fcp: null }
    }
  };
};

export const retrievePage = async (
  hostname: string,
  url: string
): Promise<RetrievePageResult> => {
  console.error(`[retrievePage] Starting for ${url}`);

  // Fetch HTML first (doesn't need driver)
  const res = await fetch(url, { headers: DEFAULT_HEADERS });
  const html = await res.text();
  const dom = parseHTML(html);
  const headers = headersToRecord(res.headers);

  // Get driver and take screenshots
  const driver = await getDriver();
  console.error('[retrievePage] Got driver');

  let desktopScreenshot: string;
  let mobileScreenshot: string;
  let metrics: VitalMetrics;

  try {
    console.error('[retrievePage] Taking desktop screenshot...');
    const desktopResult = await loadPage(driver, url, {
      screenSize: SCREEN_SIZES.desktop
    });
    desktopScreenshot = desktopResult.screenshot;
    metrics = desktopResult.metrics;
    console.error('[retrievePage] Desktop screenshot done');

    console.error('[retrievePage] Taking mobile screenshot...');
    const mobileResult = await loadPage(driver, url, {
      screenSize: SCREEN_SIZES.mobile
    });
    mobileScreenshot = mobileResult.screenshot;
    console.error('[retrievePage] Mobile screenshot done');
  } finally {
    // Always release driver, even on error
    releaseDriver();
  }

  return {
    desktopScreenshot,
    mobileScreenshot,
    pageInfo: {
      headers,
      securityHeaders: extractSecurityHeaders(headers),
      meta: extractMeta(dom),
      content: {
        html: dom.querySelector("body")?.innerHTML ?? '',
        wordCount: calculateWordCount(dom),
        headings: {
          h1: extractHeadingData(dom, 'h1'),
          h2: extractHeadingData(dom, 'h2'),
          h3: extractHeadingData(dom, 'h3'),
          h4: extractHeadingData(dom, 'h4'),
          h5: extractHeadingData(dom, 'h5'),
          h6: extractHeadingData(dom, 'h6'),
        },
      },
      images: extractImages(dom),
      links: extractLinks(dom, hostname),
      ldJson: extractLdJson(dom),
      resources: await retrieveResources(hostname, [
        ...(dom.querySelectorAll("link[rel='stylesheet']")
          .map(s => s.attributes.href!)
          .filter(Boolean)),
        ...(dom.querySelectorAll("script[src]")
          .map(s => s.attributes.src!)
          .filter(Boolean)),
      ], DEFAULT_HEADERS),
      vitalMetrics: metrics
    }
  };
};
