import { GoogleGenerativeAI } from "@google/generative-ai";
import { NextRequest, NextResponse } from "next/server";

export async function POST(req: NextRequest) {
  try {
    const { query } = await req.json();

    if (!query) {
      return NextResponse.json({ error: "Query is required" }, { status: 400 });
    }

    // Initialize Gemini API
    const apiKey = process.env.GEMINI_API_KEY;
    if (!apiKey) {
      return NextResponse.json(
        { error: "Gemini API key not found" },
        { status: 500 }
      );
    }

    const genAI = new GoogleGenerativeAI(apiKey);
    const model = genAI.getGenerativeModel({ model: "gemini-1.5-pro" });

    // Create prompt for parameter extraction with improved specific times handling
    const prompt = `
    Extract movie search parameters from this query: "${query}"
    
    I need these parameters in a JSON format:
    - movie: The name of the movie (if mentioned)
    - location: City name or ZIP code (if mentioned)
    - theater: Specific theater name (if mentioned)
    - time_range: Time range for showtimes as an object with "start" and/or "end" (in format HH:MM) if mentioned
    - specific_times: An array of specific showtimes mentioned (e.g., ["10:25", "14:35"])
    
    Pay special attention to specific times mentioned with AM/PM indicators or in context of "showings" or "showtimes".
    
    Only include parameters that are explicitly mentioned in the query.
    Return only valid JSON without any explanations.
    
    Example output format:
    {
        "movie": "Movie Name",
        "location": "City Name",
        "theater": "Theater Name",
        "time_range": {
            "start": "17:00",
            "end": "22:00"
        },
        "specific_times": ["10:25", "14:35"]
    }
    `;

    // Generate response from Gemini
    const result = await model.generateContent(prompt);
    const response = await result.response;
    let responseText = response.text();

    // Handle potential markdown formatting
    if (responseText.includes("```json")) {
      responseText = responseText.split("```json")[1].split("```")[0].trim();
    } else if (responseText.includes("```")) {
      responseText = responseText.split("```")[1].trim();
    }

    // Parse the extracted parameters
    const params = JSON.parse(responseText);

    // Add conversion for AM/PM format times to 24-hour format for specific_times if needed
    if (params.specific_times && Array.isArray(params.specific_times)) {
      params.specific_times = params.specific_times.map((time: string) => {
        // If time is already in 24-hour format (HH:MM), return as is
        if (
          /^\d{1,2}:\d{2}$/.test(time) &&
          !time.toLowerCase().includes("am") &&
          !time.toLowerCase().includes("pm")
        ) {
          return time;
        }

        // Handle times with AM/PM indicators
        let timeStr = time.toLowerCase();
        const isPM = timeStr.includes("pm");
        timeStr = timeStr.replace("am", "").replace("pm", "").trim();

        // Parse hours and minutes
        let hours = 0;
        let minutes = 0;

        if (timeStr.includes(":")) {
          const [h, m] = timeStr.split(":");
          hours = parseInt(h, 10);
          minutes = parseInt(m, 10);
        } else {
          hours = parseInt(timeStr, 10);
        }

        // Convert to 24-hour format
        if (isPM && hours < 12) hours += 12;
        if (!isPM && hours === 12) hours = 0;

        // Return in HH:MM format
        return `${hours.toString().padStart(2, "0")}:${minutes
          .toString()
          .padStart(2, "0")}`;
      });
    }

    return NextResponse.json(params);
  } catch (error) {
    console.error("Error in Gemini API:", error);
    return NextResponse.json(
      { error: "Failed to process query" },
      { status: 500 }
    );
  }
}
