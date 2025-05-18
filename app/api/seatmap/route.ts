import { NextRequest, NextResponse } from "next/server";
import { FandangoScraper } from "@/lib/fandangoScraper";

// Add a global timeout for better performance
const SCRAPER_TIMEOUT = 30000; // 30 seconds

export async function POST(req: NextRequest) {
  let scraper: FandangoScraper | null = null;

  try {
    const { timeSlotUrl } = await req.json();

    if (!timeSlotUrl) {
      return NextResponse.json(
        { error: "No time slot URL provided" },
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

    // First, set up cookies and make an initial visit to fandango.com
    await scraper.navigateToFandango();
    await scraper.manageCookies();

    // Navigate to the time slot URL using the safer method
    const timeoutPromise = new Promise((_, reject) => {
      setTimeout(() => {
        reject(new Error("Scraper operation timed out"));
      }, SCRAPER_TIMEOUT * 1.5); // Give a bit extra time than the internal timeout
    });

    // Use the safe navigation method that handles access denied better
    const results = (await Promise.race([
      scraper.navigateToTimeSlotSafely(timeSlotUrl),
      timeoutPromise,
    ])) as any; // Use type assertion to handle promise race result

    // Return a useful message for access denied errors
    if (
      results.error &&
      (results.error.includes("Access Denied") ||
        results.error.includes("blocked access"))
    ) {
      return NextResponse.json({
        error:
          "Access to seat availability is restricted by Fandango. This is normal and doesn't affect the showtime information.",
        message:
          "Fandango restricts access to seat information for third-party applications.",
        screenshots: results.screenshots || [],
      });
    }

    return NextResponse.json(results);
  } catch (error) {
    console.error("Error in seat map API:", error);
    const errorMessage = error instanceof Error ? error.message : String(error);

    // Special handling for Access Denied or permission errors
    if (
      errorMessage.includes("Access Denied") ||
      errorMessage.includes("don't have permission") ||
      errorMessage.includes("403")
    ) {
      return NextResponse.json({
        error:
          "Access to seat availability is restricted by Fandango. This is normal and doesn't affect the showtime information.",
        message:
          "Fandango restricts access to seat information for third-party applications.",
      });
    }

    return NextResponse.json(
      {
        error: errorMessage.includes("timed out")
          ? "The seat map operation took too long. Please try again."
          : `Failed to get seat map: ${errorMessage}`,
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
