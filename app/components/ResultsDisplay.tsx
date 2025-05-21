"use client";

import Image from "next/image";
import { type ScraperResult, type TimeSlot } from "@/lib/fandangoScraper";
import { useState, useEffect } from "react";
import { toast } from "react-hot-toast";
import styles from "../theme.module.css";

interface ResultsDisplayProps {
  results: ScraperResult | null;
}

export default function ResultsDisplay({ results }: ResultsDisplayProps) {
  const [isVisible, setIsVisible] = useState(false);
  const [showDebug, setShowDebug] = useState(false);

  useEffect(() => {
    if (results) {
      // Small delay before showing the element for transition effect
      const timer = setTimeout(() => {
        setIsVisible(true);
      }, 100);

      return () => clearTimeout(timer);
    } else {
      setIsVisible(false);
    }
  }, [results]);

  const handleTimeSlotClick = (timeSlot: TimeSlot) => {
    if (!timeSlot.url) {
      toast.error("No URL available for this time slot");
      return;
    }

    // Open the Fandango URL in a new tab
    window.open(timeSlot.url, "_blank");
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
      <div className={`w-full p-6 ${styles.gradientCard}`}>
        {results.error ? (
          <div className="text-red-600">
            <p className="mb-2 font-medium">
              I couldn't find what you're looking for:
            </p>
            <p>{results.error}</p>
          </div>
        ) : (
          <div className="text-gray-700">
            <h2 className={`text-xl mb-4 ${styles.gradientText}`}>
              Search Results
            </h2>
            {results.movieTitle && (
              <p className="font-bold text-lg mb-2">{results.movieTitle}</p>
            )}
            {results.theaterName && (
              <p className="text-gray-600 mb-4">{results.theaterName}</p>
            )}
          </div>
        )}

        {/* Debug information toggle */}
        {/* <div className="mt-2 mb-4">
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
        </div> */}

        {results.screenshots && results.screenshots.length > 0 && (
          <div className="mt-4">
            <div className="w-full">
              <div className="rounded-lg overflow-hidden border border-gray-100 mt-2 shadow-sm">
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
        {timeSlots.length > 0 && (
          <div className="mt-6">
            <h3 className="font-medium mb-3 text-gray-700">
              Select a time to go to Fandango:
            </h3>
            <div className="flex flex-wrap gap-3">
              {timeSlots.map((timeSlot, index) => (
                <button
                  key={`${timeSlot.time}-${index}`}
                  onClick={() => handleTimeSlotClick(timeSlot)}
                  disabled={!timeSlot.url}
                  className={`${styles.gradientButton} py-2 px-4 ${
                    !timeSlot.url ? "opacity-50 cursor-not-allowed" : ""
                  }`}
                >
                  <span>{timeSlot.time}</span>
                  {timeSlot.url && (
                    <svg
                      className="ml-1 h-4 w-4 inline-block"
                      xmlns="http://www.w3.org/2000/svg"
                      viewBox="0 0 20 20"
                      fill="currentColor"
                    >
                      <path d="M11 3a1 1 0 100 2h2.586l-6.293 6.293a1 1 0 101.414 1.414L15 6.414V9a1 1 0 102 0V4a1 1 0 00-1-1h-5z" />
                      <path d="M5 5a2 2 0 00-2 2v8a2 2 0 002 2h8a2 2 0 002-2v-3a1 1 0 10-2 0v3H5V7h3a1 1 0 000-2H5z" />
                    </svg>
                  )}
                </button>
              ))}
            </div>
          </div>
        )}

        {(!results.screenshots || results.screenshots.length === 0) &&
          !results.error && (
            <div className="text-blue-700 mt-3">
              <p>No screenshots were captured during this search.</p>
            </div>
          )}
      </div>
    </div>
  );
}
