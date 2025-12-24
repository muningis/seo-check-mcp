import { WebDriver } from 'selenium-webdriver';

interface LoadPageOptions {
  timeout?: number;
  screenSize: {
    width: number;
    height: number;
  }
}

interface LoadPageReturn {
  screenshot: Base64String;
  metrics: VitalMetrics;
}

export async function loadPage(
  driver: WebDriver,
  url: string,
  { screenSize, timeout = 30000 }: LoadPageOptions
): Promise<LoadPageReturn> {

  try {
    await driver.manage().window().setRect({
      width: screenSize.width,
      height: screenSize.height
    });

    await driver.get(url);

    await driver.wait(async () => {
      const readyState = await driver.executeScript('return document.readyState');
      return readyState === 'complete';
    }, timeout);

    // Collect navigation timing metrics
    const navigationMetrics = await driver.executeScript(() => {
      const navigationEntries = performance.getEntriesByType('navigation');
      const navTiming = navigationEntries[0] as PerformanceNavigationTiming | undefined;

      if (!navTiming) {
        return {
          timeToFirstByteMS: 0,
          loadCompleteMS: 0,
          domInteractiveMS: 0,
          domContentLoadedMS: 0,
        };
      }

      return {
        timeToFirstByteMS: navTiming.responseStart - navTiming.requestStart,
        loadCompleteMS: navTiming.loadEventEnd,
        domInteractiveMS: navTiming.domInteractive,
        domContentLoadedMS: navTiming.domContentLoadedEventEnd,
      };
    }) as {
      timeToFirstByteMS: number;
      loadCompleteMS: number;
      domInteractiveMS: number;
      domContentLoadedMS: number;
    };

    // Collect Core Web Vitals using PerformanceObserver
    // Wait a bit for LCP and CLS to stabilize
    await new Promise(resolve => setTimeout(resolve, 2000));

    const coreWebVitals = await driver.executeScript(() => {
      const metrics: { lcp: number | null; cls: number | null; fcp: number | null } = {
        lcp: null,
        cls: null,
        fcp: null,
      };

      // Get LCP from performance entries
      const lcpEntries = performance.getEntriesByType('largest-contentful-paint') as PerformanceEntry[];
      if (lcpEntries.length > 0) {
        const lastLcp = lcpEntries[lcpEntries.length - 1];
        metrics.lcp = lastLcp?.startTime ?? null;
      }

      // Get FCP from paint entries
      const paintEntries = performance.getEntriesByType('paint');
      const fcpEntry = paintEntries.find(entry => entry.name === 'first-contentful-paint');
      if (fcpEntry) {
        metrics.fcp = fcpEntry.startTime;
      }

      // CLS requires observing layout shifts - get from buffered entries
      try {
        const layoutShiftEntries = performance.getEntriesByType('layout-shift') as (PerformanceEntry & { value: number; hadRecentInput: boolean })[];
        let clsValue = 0;
        for (const entry of layoutShiftEntries) {
          if (!entry.hadRecentInput) {
            clsValue += entry.value;
          }
        }
        metrics.cls = clsValue;
      } catch {
        // layout-shift might not be supported
        metrics.cls = null;
      }

      return metrics;
    }) as CoreWebVitals;

    const metrics: VitalMetrics = {
      ...navigationMetrics,
      coreWebVitals,
    };

    const screenshot = await driver.takeScreenshot();

    return { screenshot, metrics };
  } catch (error) {
    console.error('Error loading page:', error);
    throw error;
  }
}
