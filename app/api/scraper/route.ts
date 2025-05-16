import { NextRequest, NextResponse } from "next/server";
import { FandangoScraper, ScraperQuery } from "@/lib/fandangoScraper";

// Define the config for serverless functions with increased timeout
export const config = {
  maxDuration: 120, // Increase function timeout to 120 seconds for scraping operations
};

export async function POST(req: NextRequest) {
  let scraper: FandangoScraper | null = null;

  try {
    console.log("Received scraper request");

    const query: ScraperQuery = await req.json();
    console.log("Query parameters:", JSON.stringify(query));

    if (!query || (!query.movie && !query.location && !query.theater)) {
      console.log("Error: No valid search parameters provided");
      return NextResponse.json(
        { error: "No valid search parameters provided" },
        { status: 400 }
      );
    }

    // Check browser endpoint for debugging
    console.log(
      `Browser endpoint: ${process.env.BROWSER_WS_ENDPOINT || "Not set"}`
    );

    // Initialize the scraper
    scraper = new FandangoScraper(true, 60000);
    console.log("Initializing scraper...");
    const initialized = await scraper.initialize();

    if (!initialized) {
      console.log("Error: Failed to initialize scraper");
      return NextResponse.json(
        { error: "Failed to initialize scraper" },
        { status: 500 }
      );
    }

    console.log("Scraper initialized, processing query...");

    // Process the query
    const results = await scraper.processQuery(query);
    console.log("Query processed, returning results");

    return NextResponse.json(results);
  } catch (error) {
    console.error("Error in scraper API:", error);
    return NextResponse.json(
      { error: `Failed to process scraper request: ${error}` },
      { status: 500 }
    );
  } finally {
    // Clean up resources
    if (scraper) {
      console.log("Cleaning up scraper resources");
      await scraper.close();
    }
  }
}
