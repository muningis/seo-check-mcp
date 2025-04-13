import { WebDriver } from 'selenium-webdriver';

interface LoadPageOptions {
  screenSize: {
    width: number;
    height: number;
  }
}

interface LoadPageReturn {
  screenshot: Base64String;
}

export async function loadPage(
  driver: WebDriver,
  url: string,
  options: LoadPageOptions
): Promise<LoadPageReturn> {
  try {
    await driver.manage().window().setRect({
      width: options.screenSize.width,
      height: options.screenSize.height
    });

    await driver.get(url);

    await driver.wait(async () => {
      const readyState = await driver.executeScript('return document.readyState');
      return readyState === 'complete';
    }, 30000);

    const screenshot =  await driver.takeScreenshot();

    return { screenshot };
  } catch (error) {
    console.error('Error taking screenshot:', error);
    throw error;
  }
}