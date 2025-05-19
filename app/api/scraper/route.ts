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
    scraper = await FandangoScraper.getOrCreateSession();

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

    // Make sure the sessionId is included in the results
    if (!results.sessionId && scraper) {
      results.sessionId = scraper.sessionId;
    }

    return NextResponse.json(results);
  } catch (error) {
    console.error("Error in scraper API:", error);
    const errorMessage = error instanceof Error ? error.message : String(error);

    if (scraper) {
      scraper.hasError = true;
    }

    return NextResponse.json(
      {
        error: errorMessage.includes("timed out")
          ? "The search operation took too long. Please try a more specific search."
          : `Failed to process search: ${errorMessage}`,
      },
      { status: 500 }
    );
  } finally {
    // Only close the scraper if there was an error
    // Otherwise keep it alive for potential seat map requests
    if (scraper && scraper.hasError) {
      await scraper.close();
    }
  }
}
