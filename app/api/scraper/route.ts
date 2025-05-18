import { NextRequest, NextResponse } from "next/server";
import { FandangoScraper, ScraperQuery } from "@/lib/fandangoScraper";

// Add a global timeout for better performance
const SCRAPER_TIMEOUT = 30000; // 30 seconds

export async function POST(req: NextRequest) {
  let scraper: FandangoScraper | null = null;

  try {
    const query: ScraperQuery = await req.json();

    if (!query || (!query.movie && !query.location && !query.theater)) {
      return NextResponse.json(
        { error: "No valid search parameters provided" },
        { status: 400 }
      );
    }

    // Initialize the scraper with reduced timeout
    scraper = new FandangoScraper(true, SCRAPER_TIMEOUT);
    const initialized = await scraper.initialize();

    if (!initialized) {
      return NextResponse.json(
        { error: "Failed to initialize scraper" },
        { status: 500 }
      );
    }

    // Process the query with timeout
    const timeoutPromise = new Promise((_, reject) => {
      setTimeout(() => {
        reject(new Error("Scraper operation timed out"));
      }, SCRAPER_TIMEOUT * 1.5); // Give a bit extra time than the internal timeout
    });

    const results = (await Promise.race([
      scraper.processQuery(query),
      timeoutPromise,
    ])) as any; // Use type assertion to handle promise race result

    return NextResponse.json(results);
  } catch (error) {
    console.error("Error in scraper API:", error);
    const errorMessage = error instanceof Error ? error.message : String(error);

    return NextResponse.json(
      {
        error: errorMessage.includes("timed out")
          ? "The search operation took too long. Please try a more specific search."
          : `Failed to process search: ${errorMessage}`,
      },
      { status: 500 }
    );
  } finally {
    // Clean up resources
    if (scraper) {
      await scraper.close();
    }
  }
}
