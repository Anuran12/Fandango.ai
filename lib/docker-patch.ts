// This file contains modifications to make Playwright work better in Docker environments
// Add these patches to the FandangoScraper.ts file

/*
In the initialize() method of the FandangoScraper class, replace:

this.browser = await chromium.launch({
  headless: this.headless,
  timeout: this.timeout,
});

with:

const isDocker = process.env.CONTAINER === 'true' || process.env.RENDER === 'true';
console.log(`Running in Docker/Render environment: ${isDocker}`);

this.browser = await chromium.launch({
  headless: true, // Always use headless in Docker
  timeout: this.timeout,
  args: [
    '--disable-dev-shm-usage',
    '--disable-setuid-sandbox',
    '--no-sandbox',
    '--disable-gpu',
  ]
});
*/
