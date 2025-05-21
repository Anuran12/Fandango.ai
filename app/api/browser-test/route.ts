import { NextRequest, NextResponse } from "next/server";
import { chromium } from "playwright-core";

export async function GET(req: NextRequest) {
  try {
    console.log("Browser test: Starting...");

    // Check environment variables
    const chromiumPath = process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH;
    const browsersPath = process.env.PLAYWRIGHT_BROWSERS_PATH;

    console.log(
      `PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH: ${chromiumPath || "not set"}`
    );
    console.log(`PLAYWRIGHT_BROWSERS_PATH: ${browsersPath || "not set"}`);

    // Try to launch browser with explicit executable path
    console.log("Attempting to launch browser...");
    const browser = await chromium.launch({
      headless: true,
      executablePath: chromiumPath,
      args: [
        "--disable-dev-shm-usage",
        "--disable-setuid-sandbox",
        "--no-sandbox",
        "--disable-gpu",
      ],
    });

    console.log("Browser launched successfully!");
    const version = await browser.version();

    // Create a context and page to verify everything works
    const context = await browser.newContext();
    const page = await context.newPage();

    // Navigate to a simple URL
    await page.goto("about:blank");
    console.log("Page navigation successful");

    const userAgent = await page.evaluate(() => navigator.userAgent);

    // Close everything
    await page.close();
    await context.close();
    await browser.close();

    console.log("Browser test completed successfully!");

    return NextResponse.json({
      success: true,
      message: "Browser launched successfully",
      version,
      userAgent,
      environment: {
        chromiumPath,
        browsersPath,
        platform: process.platform,
        arch: process.arch,
        nodeVersion: process.version,
      },
    });
  } catch (error) {
    console.error("Browser test error:", error);
    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : String(error),
        environment: {
          chromiumPath: process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH,
          browsersPath: process.env.PLAYWRIGHT_BROWSERS_PATH,
          platform: process.platform,
          arch: process.arch,
          nodeVersion: process.version,
        },
      },
      { status: 500 }
    );
  }
}
