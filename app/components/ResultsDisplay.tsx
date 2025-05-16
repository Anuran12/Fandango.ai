"use client";

import Image from "next/image";
import { type ScraperResult } from "@/lib/fandangoScraper";

interface ResultsDisplayProps {
  results: ScraperResult | null;
}

export default function ResultsDisplay({ results }: ResultsDisplayProps) {
  if (!results) {
    return null;
  }

  return (
    <div className="w-full max-w-3xl bg-white rounded-lg shadow-md p-6 my-4">
      <h2 className="text-xl font-bold mb-4 text-gray-800">Results</h2>

      {results.error ? (
        <div className="bg-red-100 text-red-700 p-4 rounded-md mb-4">
          <p className="font-medium">Error:</p>
          <p>{results.error}</p>
        </div>
      ) : (
        <div className="bg-green-100 text-green-700 p-4 rounded-md mb-4">
          <p>Search completed successfully</p>
        </div>
      )}

      {results.screenshots && results.screenshots.length > 0 && (
        <div className="mt-6">
          <h3 className="text-lg font-medium mb-4 text-gray-800">Screenshot</h3>
          <div className="w-full">
            <div className="rounded-lg overflow-hidden shadow-md relative">
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

      {(!results.screenshots || results.screenshots.length === 0) && (
        <div className="bg-blue-100 text-blue-700 p-4 rounded-md">
          <p>No screenshots were captured during this search.</p>
        </div>
      )}
    </div>
  );
}
