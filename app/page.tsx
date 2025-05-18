"use client";

import { useState, useEffect, useRef } from "react";
import { Toaster, toast } from "react-hot-toast";
import { type ScraperQuery, type ScraperResult } from "@/lib/fandangoScraper";

import SearchForm from "./components/SearchForm";
import ParametersDisplay from "./components/ParametersDisplay";
import ResultsDisplay from "./components/ResultsDisplay";
import InfoSection from "./components/InfoSection";

// Add a UserQueryMessage component
const UserQueryMessage = ({ query }: { query: string }) => {
  if (!query) return null;

  return (
    <div className="w-full my-4 flex justify-end">
      <div className="bg-blue-600 text-white p-4 rounded-lg shadow-sm max-w-[80%]">
        <p className="whitespace-pre-wrap break-words">{query}</p>
      </div>
    </div>
  );
};

// Add a scroll button component
const ScrollToBottomButton = ({ onClick }: { onClick: () => void }) => (
  <button
    onClick={onClick}
    className="fixed bottom-20 right-4 p-2 bg-gray-200 rounded-full shadow-md hover:bg-gray-300 focus:outline-none z-50"
    aria-label="Scroll to bottom"
  >
    <svg
      xmlns="http://www.w3.org/2000/svg"
      className="h-6 w-6 text-gray-600"
      fill="none"
      viewBox="0 0 24 24"
      stroke="currentColor"
    >
      <path
        strokeLinecap="round"
        strokeLinejoin="round"
        strokeWidth={2}
        d="M19 14l-7 7m0 0l-7-7m7 7V3"
      />
    </svg>
  </button>
);

export default function Home() {
  const [queryHistory, setQueryHistory] = useState<string[]>([]);
  const [currentQuery, setCurrentQuery] = useState<string>("");
  const [extractedParams, setExtractedParams] = useState<ScraperQuery | null>(
    null
  );
  const [scraperResults, setScraperResults] = useState<ScraperResult | null>(
    null
  );
  const [isProcessing, setIsProcessing] = useState(false);

  // Add refs for scroll targets
  const contentRef = useRef<HTMLDivElement>(null);
  const bottomRef = useRef<HTMLDivElement>(null);
  const resultsRef = useRef<HTMLDivElement>(null);

  // Simplified scroll function that uses scrollIntoView
  const scrollToBottom = () => {
    if (bottomRef.current) {
      bottomRef.current.scrollIntoView({
        behavior: "smooth",
        block: "end",
      });
    }
  };

  // Scroll to results when they change
  useEffect(() => {
    if (scraperResults) {
      setTimeout(() => {
        if (resultsRef.current) {
          resultsRef.current.scrollIntoView({
            behavior: "smooth",
            block: "center",
          });
        } else {
          scrollToBottom();
        }
      }, 100);
    }
  }, [scraperResults]);

  // Scroll when parameters are loaded or processing state changes
  useEffect(() => {
    if (extractedParams || isProcessing) {
      scrollToBottom();
    }
  }, [extractedParams, isProcessing]);

  const handleSearch = async (query: string, params: ScraperQuery) => {
    // Add the query to history if it's not already there
    if (!queryHistory.includes(query)) {
      setQueryHistory([...queryHistory, query]);
    }

    // Set current query to display in the UI
    setCurrentQuery(query);
    setExtractedParams(params);
    setScraperResults(null);
    setIsProcessing(true);

    // Scroll to show processing indicator
    scrollToBottom();

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

      // Set results and scroll once they're available
      setScraperResults(results);
      // Use a timeout to allow the DOM to update
      setTimeout(scrollToBottom, 100);
    } catch (error) {
      console.error("Error in scraper process:", error);
      toast.error("Failed to process scraping request");
      setScraperResults({ error: "Failed to process scraping request" });
      setTimeout(scrollToBottom, 100);
    } finally {
      setIsProcessing(false);
    }
  };

  const handleClearResults = () => {
    setCurrentQuery("");
    setExtractedParams(null);
    setScraperResults(null);
    toast.success("Results cleared");
  };

  return (
    <main className="min-h-screen bg-white flex flex-col relative">
      <Toaster position="bottom-right" />

      {/* ChatGPT-style header - now fixed */}
      <div className="fixed top-0 left-0 w-full border-b border-gray-200 py-3 px-4 flex items-center justify-between bg-white z-10">
        <div className="flex items-center">
          <h1 className="text-xl font-medium text-gray-800 flex items-center">
            <span className="mr-2">🎬</span> Fandango Explorer
          </h1>
        </div>
        <button
          onClick={handleClearResults}
          className="text-gray-500 hover:text-gray-700 px-2 py-1 rounded text-sm"
        >
          {extractedParams || scraperResults ? "Clear chat" : ""}
        </button>
      </div>

      {/* Scrollable content area with scroll-snap - add top padding for fixed header */}
      <div
        ref={contentRef}
        className="flex-grow overflow-y-auto container mx-auto px-4 pb-24 pt-14 scroll-pt-16"
        style={{ scrollBehavior: "smooth" }}
        id="chat-content"
      >
        <div className="flex flex-col items-center">
          <div className="w-full max-w-4xl">
            {(scraperResults || isProcessing) && (
              <div className="h-[15vh]"></div>
            )}

            {!currentQuery && <InfoSection />}

            {/* Display the user query if available */}
            {currentQuery && <UserQueryMessage query={currentQuery} />}

            <ParametersDisplay params={extractedParams} />

            {/* Add ref to the results section */}
            <div ref={resultsRef}>
              <ResultsDisplay results={scraperResults} />
            </div>

            {scraperResults && <div className="h-[15vh]"></div>}

            {isProcessing && (
              <div className="my-6 flex flex-col items-center">
                <div className="animate-spin rounded-full h-8 w-8 border-t-2 border-b-2 border-blue-500"></div>
                <p className="mt-2 text-gray-600 text-sm">Searching...</p>
              </div>
            )}

            {/* Invisible element at the bottom for scrolling target */}
            <div ref={bottomRef} className="h-4" id="bottom-anchor"></div>
          </div>
        </div>
      </div>

      {/* Scroll to bottom button */}
      {(scraperResults || extractedParams || isProcessing) && (
        <ScrollToBottomButton onClick={scrollToBottom} />
      )}

      {/* Fixed input area at the bottom - ChatGPT style */}
      <div className="fixed bottom-0 w-full shadow-md pb-5 px-4 bg-white">
        <div className="container mx-auto flex justify-center">
          <SearchForm onSubmit={handleSearch} isProcessing={isProcessing} />
        </div>
        <div className="text-center text-xs text-gray-400 mt-2">
          Search for movies, theaters, and showtimes in natural language
        </div>
      </div>
    </main>
  );
}
