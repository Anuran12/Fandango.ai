import { NextRequest, NextResponse } from "next/server";
import { chromium } from "playwright-core";
import os from "os";
import fs from "fs";
import path from "path";
import process from "process";

// Define proper types for browserInfo
type BrowserInfoSuccess = {
  success: true;
  title: string;
  userAgent: string;
};

type BrowserInfoError = {
  success: false;
  error: string;
};

type BrowserInfo = BrowserInfoSuccess | BrowserInfoError;

export async function GET(req: NextRequest) {
  try {
    // Get system information
    const systemInfo = {
      platform: os.platform(),
      release: os.release(),
      hostname: os.hostname(),
      arch: os.arch(),
      cpus: os.cpus().length,
      totalMemory: os.totalmem(),
      freeMemory: os.freemem(),
      uptime: os.uptime(),
      nodeVersion: process.version,
      cwd: process.cwd(),
      env: {
        NODE_ENV: process.env.NODE_ENV,
        RENDER: process.env.RENDER,
        PORT: process.env.PORT,
      },
    };

    // Check for playwright browser paths
    const msPlaywrightPath = "/ms-playwright";
    const cachePath = "/root/.cache/ms-playwright";

    const playwrightPaths = {
      msPlaywrightExists: fs.existsSync(msPlaywrightPath),
      msPlaywrightContents: fs.existsSync(msPlaywrightPath)
        ? fs.readdirSync(msPlaywrightPath).join(", ")
        : "directory not found",
      cacheDirExists: fs.existsSync(cachePath),
      cacheDirContents: fs.existsSync(cachePath)
        ? fs.readdirSync(cachePath).join(", ")
        : "directory not found",
    };

    // Try to launch browser
    let browserInfo: BrowserInfo;
    try {
      console.log("Testing browser launch...");
      const browser = await chromium.launch({
        headless: true,
        args: [
          "--disable-dev-shm-usage",
          "--disable-setuid-sandbox",
          "--no-sandbox",
          "--disable-gpu",
        ],
      });

      const context = await browser.newContext();
      const page = await context.newPage();

      await page.goto("about:blank");
      const title = await page.title();

      await browser.close();
      browserInfo = {
        success: true,
        title,
        userAgent: await page.evaluate(() => navigator.userAgent),
      };
    } catch (error) {
      browserInfo = {
        success: false,
        error: error instanceof Error ? error.message : String(error),
      };
    }

    return NextResponse.json({
      status: "ok",
      message: "Debug info",
      systemInfo,
      playwrightPaths,
      browserInfo,
    });
  } catch (error) {
    console.error("Debug error:", error);
    return NextResponse.json({
      status: "error",
      message: error instanceof Error ? error.message : String(error),
    });
  }
}
