"use client";

import Image from "next/image";
import { type ScraperResult, type TimeSlot } from "@/lib/fandangoScraper";
import { useState, useEffect } from "react";
import { toast } from "react-hot-toast";

interface ResultsDisplayProps {
  results: ScraperResult | null;
}

export default function ResultsDisplay({ results }: ResultsDisplayProps) {
  const [isVisible, setIsVisible] = useState(false);
  const [selectedTimeSlot, setSelectedTimeSlot] = useState<TimeSlot | null>(
    null
  );
  const [isFetchingSeats, setIsFetchingSeats] = useState(false);
  const [seatMapResult, setSeatMapResult] = useState<ScraperResult | null>(
    null
  );
  const [showDebug, setShowDebug] = useState(false);

  useEffect(() => {
    if (results) {
      // Small delay before showing the element for transition effect
      const timer = setTimeout(() => {
        setIsVisible(true);
      }, 100);

      // Reset seat view state when new results come in
      setSelectedTimeSlot(null);
      setSeatMapResult(null);

      return () => clearTimeout(timer);
    } else {
      setIsVisible(false);
    }
  }, [results]);

  const handleTimeSlotClick = async (timeSlot: TimeSlot) => {
    if (!timeSlot.url) {
      toast.error("No URL available for this time slot");
      return;
    }

    setSelectedTimeSlot(timeSlot);
    setIsFetchingSeats(true);
    setSeatMapResult(null);

    try {
      const response = await fetch("/api/seatmap", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ timeSlotUrl: timeSlot.url }),
      });

      const seatMapData = await response.json();

      // Still display result even if there was an error
      setSeatMapResult(seatMapData);

      // Show toast for access denied errors
      if (
        seatMapData.error &&
        (seatMapData.error.includes("Access Denied") ||
          seatMapData.error.includes("blocked access") ||
          seatMapData.error.includes("restricted"))
      ) {
        toast(
          "Fandango restricts direct access to seat maps. Click 'View on Fandango' to see availability.",
          {
            icon: "🎟️",
            style: {
              background: "#EFF6FF",
              color: "#1E40AF",
            },
          }
        );
      } else if (!response.ok) {
        throw new Error(seatMapData.error || "Failed to fetch seat map");
      }
    } catch (error) {
      console.error("Error fetching seat map:", error);
      toast.error("Failed to fetch seat map");
    } finally {
      setIsFetchingSeats(false);
    }
  };

  if (!results) {
    return null;
  }

  // Get only highlighted time slots
  const highlightedTimeSlots =
    results.timeSlots?.filter((slot) => slot.isHighlighted) || [];

  // Get all time slots if there are no highlighted ones
  const timeSlots =
    highlightedTimeSlots.length > 0
      ? highlightedTimeSlots
      : results.timeSlots || [];

  // Debug info about time slots
  console.log("All time slots:", results.timeSlots);
  console.log("Highlighted time slots:", highlightedTimeSlots);
  console.log("Time slots to display:", timeSlots);

  return (
    <div
      className={`w-full my-6 flex justify-start transition-opacity duration-300 ${
        isVisible ? "opacity-100" : "opacity-0"
      }`}
    >
      <div className="bg-gray-50 rounded-lg p-5 text-sm text-gray-700 shadow-sm">
        {results.error ? (
          <div className="text-red-700">
            <p className="mb-2 font-medium">
              I couldn't find what you're looking for:
            </p>
            <p>{results.error}</p>
          </div>
        ) : (
          <div className="text-gray-700">
            <p className="mb-2 font-medium">Search completed successfully</p>
            {results.movieTitle && (
              <p className="font-bold text-lg mb-2">{results.movieTitle}</p>
            )}
            {results.theaterName && (
              <p className="text-gray-600 mb-4">{results.theaterName}</p>
            )}
          </div>
        )}

        {/* Debug information toggle */}
        <div className="mt-2 mb-4">
          <button
            onClick={() => setShowDebug(!showDebug)}
            className="text-xs text-blue-600 hover:text-blue-800 underline"
          >
            {showDebug ? "Hide Debug Info" : "Show Debug Info"}
          </button>

          {showDebug && (
            <div className="mt-2 bg-gray-100 p-3 rounded-md text-xs overflow-auto max-h-40">
              <p className="font-bold">Time Slots Data:</p>
              <pre className="mt-1">
                {JSON.stringify(results.timeSlots || [], null, 2)}
              </pre>
            </div>
          )}
        </div>

        {results.screenshots &&
          results.screenshots.length > 0 &&
          !seatMapResult && (
            <div className="mt-4">
              <div className="w-full">
                <div className="rounded-md overflow-hidden border border-gray-200 mt-2 shadow-sm">
                  <Image
                    src={results.screenshots[0]}
                    alt="Movie showtime screenshot"
                    width={800}
                    height={600}
                    className="w-full h-auto"
                    priority
                  />
                </div>
              </div>
            </div>
          )}

        {/* Display time slots as buttons if available */}
        {timeSlots.length > 0 && !seatMapResult && (
          <div className="mt-4">
            <h3 className="font-medium mb-2">
              Select a time to view available seats:
            </h3>
            <div className="flex flex-wrap gap-2">
              {timeSlots.map((timeSlot, index) => (
                <button
                  key={`${timeSlot.time}-${index}`}
                  onClick={() => handleTimeSlotClick(timeSlot)}
                  disabled={!timeSlot.url || isFetchingSeats}
                  className={`px-3 py-2 rounded-md ${
                    timeSlot.isHighlighted
                      ? "bg-green-600 text-white hover:bg-green-700"
                      : "bg-gray-200 hover:bg-gray-300 text-gray-800"
                  } ${
                    !timeSlot.url
                      ? "opacity-50 cursor-not-allowed"
                      : "cursor-pointer"
                  } transition-colors`}
                >
                  {timeSlot.time}
                </button>
              ))}
            </div>
          </div>
        )}

        {/* Display loading state when fetching seat map */}
        {isFetchingSeats && (
          <div className="mt-4 flex items-center justify-center py-8">
            <div className="animate-spin rounded-full h-8 w-8 border-t-2 border-b-2 border-blue-500"></div>
            <p className="ml-2">Loading seat map...</p>
          </div>
        )}

        {/* Display seat map results */}
        {seatMapResult && (
          <div className="mt-4">
            <div className="flex items-center justify-between mb-3">
              <h3 className="font-medium">
                Showtime: {selectedTimeSlot?.time}
              </h3>
              <button
                onClick={() => setSeatMapResult(null)}
                className="text-blue-600 hover:text-blue-800 text-sm"
              >
                Back to showtimes
              </button>
            </div>

            {/* Show different content based on whether there's an error */}
            {seatMapResult.error ? (
              <div
                className={
                  seatMapResult.error.includes("Access Denied") ||
                  seatMapResult.error.includes("blocked access") ||
                  seatMapResult.error.includes("restricted")
                    ? "bg-yellow-50 text-yellow-800 border border-yellow-200 p-4 rounded-md mb-3"
                    : "bg-red-100 text-red-700 p-4 rounded-md mb-3"
                }
              >
                <div className="flex items-start">
                  <div className="flex-shrink-0">
                    {seatMapResult.error.includes("Access Denied") ||
                    seatMapResult.error.includes("blocked access") ||
                    seatMapResult.error.includes("restricted") ? (
                      <svg
                        className="h-5 w-5 text-yellow-500"
                        xmlns="http://www.w3.org/2000/svg"
                        viewBox="0 0 20 20"
                        fill="currentColor"
                        aria-hidden="true"
                      >
                        <path
                          fillRule="evenodd"
                          d="M8.257 3.099c.765-1.36 2.722-1.36 3.486 0l5.58 9.92c.75 1.334-.213 2.98-1.742 2.98H4.42c-1.53 0-2.493-1.646-1.743-2.98l5.58-9.92zM11 13a1 1 0 11-2 0 1 1 0 012 0zm-1-8a1 1 0 00-1 1v3a1 1 0 002 0V6a1 1 0 00-1-1z"
                          clipRule="evenodd"
                        />
                      </svg>
                    ) : (
                      <svg
                        className="h-5 w-5 text-red-500"
                        xmlns="http://www.w3.org/2000/svg"
                        viewBox="0 0 20 20"
                        fill="currentColor"
                        aria-hidden="true"
                      >
                        <path
                          fillRule="evenodd"
                          d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.707 7.293a1 1 0 00-1.414 1.414L8.586 10l-1.293 1.293a1 1 0 101.414 1.414L10 11.414l1.293 1.293a1 1 0 001.414-1.414L11.414 10l1.293-1.293a1 1 0 00-1.414-1.414L10 8.586 8.707 7.293z"
                          clipRule="evenodd"
                        />
                      </svg>
                    )}
                  </div>
                  <div className="ml-3">
                    <h3 className="font-medium">
                      {seatMapResult.error.includes("Access Denied") ||
                      seatMapResult.error.includes("blocked access") ||
                      seatMapResult.error.includes("restricted")
                        ? "Seat maps unavailable in this application"
                        : "Error accessing seat information"}
                    </h3>
                    <div className="mt-2 text-sm">
                      {seatMapResult.error.includes("Access Denied") ||
                      seatMapResult.error.includes("blocked access") ||
                      seatMapResult.error.includes("restricted") ? (
                        <>
                          <p>
                            Fandango restricts access to seat selection in
                            third-party applications. This is normal and doesn't
                            affect the showtime information.
                          </p>
                          {selectedTimeSlot?.url && (
                            <div className="mt-3">
                              <a
                                href={selectedTimeSlot.url}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="inline-flex items-center px-4 py-2 border border-transparent text-sm font-medium rounded-md shadow-sm text-white bg-blue-600 hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500"
                              >
                                <svg
                                  className="-ml-1 mr-2 h-4 w-4"
                                  xmlns="http://www.w3.org/2000/svg"
                                  viewBox="0 0 20 20"
                                  fill="currentColor"
                                >
                                  <path d="M11 3a1 1 0 100 2h2.586l-6.293 6.293a1 1 0 101.414 1.414L15 6.414V9a1 1 0 102 0V4a1 1 0 00-1-1h-5z" />
                                  <path d="M5 5a2 2 0 00-2 2v8a2 2 0 002 2h8a2 2 0 002-2v-3a1 1 0 10-2 0v3H5V7h3a1 1 0 000-2H5z" />
                                </svg>
                                View on Fandango
                              </a>
                            </div>
                          )}
                        </>
                      ) : (
                        <p>{seatMapResult.error}</p>
                      )}
                    </div>
                  </div>
                </div>
              </div>
            ) : // Display seat map if available and no error
            seatMapResult.screenshots &&
              seatMapResult.screenshots.length > 0 ? (
              <div className="rounded-md overflow-hidden border border-gray-200 shadow-sm">
                <Image
                  src={seatMapResult.screenshots[0]}
                  alt="Seat map"
                  width={800}
                  height={600}
                  className="w-full h-auto"
                  priority
                />
              </div>
            ) : (
              <p>No seat map screenshot available</p>
            )}
          </div>
        )}

        {(!results.screenshots || results.screenshots.length === 0) &&
          !results.error &&
          !seatMapResult && (
            <div className="text-blue-700 mt-3">
              <p>No screenshots were captured during this search.</p>
            </div>
          )}
      </div>
    </div>
  );
}
