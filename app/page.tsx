"use client";

import { useState } from "react";
import { Toaster, toast } from "react-hot-toast";
import { type ScraperQuery, type ScraperResult } from "@/lib/fandangoScraper";

import SearchForm from "./components/SearchForm";
import ParametersDisplay from "./components/ParametersDisplay";
import ResultsDisplay from "./components/ResultsDisplay";
import InfoSection from "./components/InfoSection";

export default function Home() {
  const [queryHistory, setQueryHistory] = useState<string[]>([]);
  const [extractedParams, setExtractedParams] = useState<ScraperQuery | null>(
    null
  );
  const [scraperResults, setScraperResults] = useState<ScraperResult | null>(
    null
  );
  const [isProcessing, setIsProcessing] = useState(false);

  const handleSearch = async (query: string, params: ScraperQuery) => {
    // Add the query to history if it's not already there
    if (!queryHistory.includes(query)) {
      setQueryHistory([...queryHistory, query]);
    }

    setExtractedParams(params);
    setScraperResults(null);
    setIsProcessing(true);

    try {
      const response = await fetch("/api/scraper", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify(params),
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || "Failed to process scraper request");
      }

      const results = await response.json();
      setScraperResults(results);
    } catch (error) {
      console.error("Error in scraper process:", error);
      toast.error("Failed to process scraping request");
      setScraperResults({ error: "Failed to process scraping request" });
    } finally {
      setIsProcessing(false);
    }
  };

  const handleClearResults = () => {
    setExtractedParams(null);
    setScraperResults(null);
    toast.success("Results cleared");
  };

  return (
    <main className="min-h-screen bg-gray-50">
      <Toaster position="bottom-right" />

      <div className="container mx-auto px-4 py-8">
        <div className="flex flex-col items-center">
          <h1 className="text-3xl md:text-4xl font-bold text-gray-800 mb-2 flex items-center">
            <span className="mr-2">🎬</span> Fandango Movie Explorer
          </h1>
          <p className="text-gray-600 mb-8 text-center">
            Search for movies, theaters, and showtimes in natural language
          </p>

          <div className="w-full max-w-6xl">
            <div className="flex flex-col items-center">
              <InfoSection />
              <SearchForm onSubmit={handleSearch} isProcessing={isProcessing} />

              {isProcessing && (
                <div className="my-8 flex flex-col items-center">
                  <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-blue-500"></div>
                  <p className="mt-4 text-gray-600">
                    Processing your request...
                  </p>
                </div>
              )}

              <ParametersDisplay params={extractedParams} />
              <ResultsDisplay results={scraperResults} />

              {(extractedParams || scraperResults) && (
                <button
                  onClick={handleClearResults}
                  className="mt-4 px-4 py-2 bg-gray-600 text-white rounded-md hover:bg-gray-700 focus:outline-none focus:ring-2 focus:ring-gray-500"
                >
                  Clear Results
                </button>
              )}
            </div>
          </div>
        </div>
      </div>
    </main>
  );
}
