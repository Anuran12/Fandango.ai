import { NextRequest, NextResponse } from "next/server";
import { FandangoScraper, ScraperResult } from "@/lib/fandangoScraper";

// Add a global timeout for better performance
const SCRAPER_TIMEOUT = 30000; // 30 seconds

export async function POST(req: NextRequest) {
  let scraper: FandangoScraper | null = null;
  let newSession = false;

  try {
    const { timeSlotUrl, sessionId, selectedTime } = await req.json();

    if (!timeSlotUrl) {
      return NextResponse.json(
        { error: "No time slot URL provided" },
        { status: 400 }
      );
    }

    if (!selectedTime) {
      return NextResponse.json(
        { error: "No selected time provided" },
        { status: 400 }
      );
    }

    // Try to reuse existing session or create a new one
    try {
      if (sessionId) {
        console.log(`Attempting to reuse session: ${sessionId}`);
        scraper = await FandangoScraper.getOrCreateSession(sessionId);
      } else {
        console.log("No session ID provided, creating new session");
        scraper = await FandangoScraper.getOrCreateSession();
        newSession = true;
      }
    } catch (error) {
      console.log(`Error getting session, creating new: ${error}`);
      scraper = await FandangoScraper.getOrCreateSession();
      newSession = true;
    }

    // If it's a new session, we need to initialize it
    if (newSession) {
      await scraper.navigateToFandango();
      await scraper.manageCookies();
    }

    // Use the timeout for safety
    const timeoutPromise = new Promise((_, reject) => {
      setTimeout(() => {
        reject(new Error("Scraper operation timed out"));
      }, SCRAPER_TIMEOUT * 1.5);
    });

    // Use the appropriate method based on whether we're continuing a session
    let results;
    if (newSession) {
      // Use the traditional method for new sessions
      results = (await Promise.race([
        scraper.navigateToTimeSlotSafely(timeSlotUrl),
        timeoutPromise,
      ])) as ScraperResult;
    } else {
      // For existing sessions, use the continueToSeatMap method with the selected time
      results = (await Promise.race([
        scraper.continueToSeatMap(timeSlotUrl, selectedTime),
        timeoutPromise,
      ])) as ScraperResult;
    }

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
        sessionId: results.sessionId, // Return the session ID
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
    // Only close the scraper for new sessions with errors
    // We want to keep existing sessions alive
    if (scraper && newSession && scraper.hasError) {
      await scraper.close();
    }
  }
}
