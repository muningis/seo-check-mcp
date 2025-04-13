import { WebDriver } from 'selenium-webdriver';

interface ScreenshotOptions {
  width: number;
  height: number;
}

export async function takeScreenshot(
  driver: WebDriver,
  url: string,
  options: ScreenshotOptions
): Promise<Base64String> {
  try {
    await driver.manage().window().setRect({
      width: options.width,
      height: options.height
    });

    await driver.get(url);

    await driver.wait(async () => {
      const readyState = await driver.executeScript('return document.readyState');
      return readyState === 'complete';
    }, 30000);

    return await driver.takeScreenshot();
  } catch (error) {
    console.error('Error taking screenshot:', error);
    throw error;
  }
}