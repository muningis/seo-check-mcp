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

    const metrics = await driver.executeScript(() => {
      const navigationEntries = performance.getEntriesByType('navigation');
      const navTiming = navigationEntries[0]! as any;
      
      return {
        timeToFirstByteMS: (navTiming.responseStart - navTiming.requestStart) ?? 0,
        loadCompleteMS: navTiming.loadEventEnd ?? 0,
        domInteractiveMS: navTiming.domInteractive ?? 0,
        domContentLoadedMS: navTiming.domContentLoadedEventEnd ?? 0,
      } satisfies VitalMetrics;
    }) as VitalMetrics;

    const screenshot =  await driver.takeScreenshot();

    return { screenshot, metrics };
  } catch (error) {
    console.error('Error loading page:', error);
    throw error;
  }
}