"use client";

import { useState, useEffect, useRef } from "react";
import { Toaster, toast } from "react-hot-toast";
import { type ScraperQuery, type ScraperResult } from "@/lib/fandangoScraper";

import SearchForm from "./components/SearchForm";
import ResultsDisplay from "./components/ResultsDisplay";
import InfoSection from "./components/InfoSection";
import { FandangoLogo } from "./components/FandangoLogo";
import styles from "./theme.module.css";

// Add a UserQueryMessage component
const UserQueryMessage = ({ query }: { query: string }) => {
  if (!query) return null;

  return (
    <div className="w-full my-4 flex justify-end">
      <div className="bg-gradient-to-r from-blue-600 via-purple-600 to-pink-500 p-[2.5px] rounded-2xl">
        <div className="rounded-2xl bg-white p-4 text-gray-800">
          <p className="whitespace-pre-wrap break-words">{query}</p>
        </div>
      </div>
    </div>
  );
};

// Add a scroll button component
const ScrollToBottomButton = ({ onClick }: { onClick: () => void }) => (
  <button
    onClick={onClick}
    className={`${styles.scrollButton} fixed bottom-20 right-4 z-50`}
    aria-label="Scroll to bottom"
  >
    <svg
      xmlns="http://www.w3.org/2000/svg"
      className="h-6 w-6"
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

  // Function to just display the user query and set processing state
  // without triggering the scraper API yet
  const displayUserQuery = (query: string) => {
    // Add the query to history if it's not already there
    if (!queryHistory.includes(query)) {
      setQueryHistory([...queryHistory, query]);
    }

    // Just set current query to display in the UI and set processing state
    setCurrentQuery(query);
    setIsProcessing(true);

    // Scroll to show processing indicator
    scrollToBottom();
  };

  const handleClearResults = () => {
    setCurrentQuery("");
    setExtractedParams(null);
    setScraperResults(null);
    toast.success("Results cleared");
  };

  return (
    <main className="min-h-screen bg-white flex flex-col relative">
      <Toaster
        position="bottom-right"
        toastOptions={{
          style: {
            borderRadius: "10px",
            background: "#fff",
            color: "#333",
            boxShadow: "0 3px 10px rgba(0, 0, 0, 0.1)",
            border: "1px solid #f0f0f0",
          },
          success: {
            iconTheme: {
              primary: "#6BB76D",
              secondary: "#fff",
            },
          },
          error: {
            iconTheme: {
              primary: "#E53E3E",
              secondary: "#fff",
            },
          },
        }}
      />

      {/* Header with Fandango logo */}
      <div className="fixed top-0 left-0 w-full py-3 px-4 flex items-center justify-center bg-white z-10 border-b border-gray-100 shadow-sm">
        <div className="flex justify-center items-center">
          <FandangoLogo />
        </div>
        {(extractedParams || scraperResults) && (
          <button
            onClick={handleClearResults}
            className={`${styles.gradientButton} py-1 px-3 text-xs !absolute right-4 top-3`}
          >
            Clear chat
          </button>
        )}
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

            {/* Add ref to the results section */}
            <div ref={resultsRef}>
              <ResultsDisplay results={scraperResults} />
            </div>

            {scraperResults && <div className="h-[15vh]"></div>}

            {isProcessing && (
              <div className="my-6 flex flex-col items-center">
                <div className="animate-spin rounded-full h-8 w-8 border-t-2 border-b-2 border-[#a259ff]"></div>
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
      <div className="fixed bottom-0 w-full shadow-md pb-8 px-4 bg-white">
        <div className="container mx-auto flex justify-center">
          <SearchForm
            onSubmit={handleSearch}
            isProcessing={isProcessing}
            displayUserQuery={displayUserQuery}
          />
        </div>
        <div className="text-center text-xs text-gray-400 mt-2">
          Search for movies, theaters, and showtimes in natural language
        </div>
      </div>
    </main>
  );
}
