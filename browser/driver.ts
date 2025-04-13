import { Builder, Browser } from "selenium-webdriver";
import { Options as ChromeOptions } from 'selenium-webdriver/chrome';

const chromeOptions = new ChromeOptions();
chromeOptions.addArguments('--headless=new');

export const driver = new Builder()
  .forBrowser(Browser.CHROME)
  .setChromeOptions(chromeOptions)
  .build();