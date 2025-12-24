import { Builder, Browser, type WebDriver } from "selenium-webdriver";
import { Options as ChromeOptions } from 'selenium-webdriver/chrome';

const chromeOptions = new ChromeOptions();
chromeOptions.addArguments('--headless=new');
chromeOptions.addArguments('--no-sandbox');
chromeOptions.addArguments('--disable-dev-shm-usage');
chromeOptions.addArguments('--disable-gpu');

let driverInstance: WebDriver | null = null;
let driverPromise: Promise<WebDriver> | null = null;
let isDriverBusy = false;
let busyQueue: Array<() => void> = [];

const waitForDriver = (): Promise<void> => {
  if (!isDriverBusy) return Promise.resolve();
  return new Promise(resolve => busyQueue.push(resolve));
};

const releaseDriver = (): void => {
  isDriverBusy = false;
  const next = busyQueue.shift();
  if (next) next();
};

export const getDriver = async (): Promise<WebDriver> => {
  // Wait if driver is busy with another request
  await waitForDriver();
  isDriverBusy = true;

  if (!driverInstance && !driverPromise) {
    console.error('[WebDriver] Creating new driver instance...');
    driverPromise = new Builder()
      .forBrowser(Browser.CHROME)
      .setChromeOptions(chromeOptions)
      .build();
    driverInstance = await driverPromise;
    driverPromise = null;
    console.error('[WebDriver] Driver created successfully');
  } else if (driverPromise) {
    console.error('[WebDriver] Waiting for driver creation...');
    driverInstance = await driverPromise;
  } else if (driverInstance) {
    // Verify session is still valid
    try {
      await driverInstance.getSession();
      console.error('[WebDriver] Reusing existing driver');
    } catch (e) {
      console.error('[WebDriver] Session invalid, recreating driver...', e);
      driverInstance = null;
      releaseDriver();
      return getDriver();
    }
  }
  return driverInstance!;
};

export { releaseDriver };

export const quitDriver = async (): Promise<void> => {
  if (driverInstance) {
    console.error('[WebDriver] Quitting driver...');
    try {
      await driverInstance.quit();
    } catch (e) {
      console.error('[WebDriver] Error quitting driver:', e);
    }
    driverInstance = null;
  }
};