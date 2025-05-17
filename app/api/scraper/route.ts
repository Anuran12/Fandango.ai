import { NextRequest, NextResponse } from "next/server";
import { FandangoScraper, ScraperQuery } from "@/lib/fandangoScraper";

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

    // Initialize the scraper
    scraper = new FandangoScraper(true, 60000);
    const initialized = await scraper.initialize();

    if (!initialized) {
      return NextResponse.json(
        { error: "Failed to initialize scraper" },
        { status: 500 }
      );
    }

    // Process the query
    const results = await scraper.processQuery(query);

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
      await scraper.close();
    }
  }
}
