"use client";

import { useState, useRef, useEffect } from "react";
import { toast } from "react-hot-toast";
import { type ScraperQuery } from "@/lib/fandangoScraper";

interface SearchFormProps {
  onSubmit: (query: string, params: ScraperQuery) => void;
  isProcessing: boolean;
}

export default function SearchForm({
  onSubmit,
  isProcessing,
}: SearchFormProps) {
  const [query, setQuery] = useState("");
  const inputRef = useRef<HTMLInputElement>(null);

  // Function to trigger scrolling in the parent container
  const triggerScroll = () => {
    // Find the content container
    const contentContainer = document.getElementById("chat-content");
    if (contentContainer) {
      // Force scroll to bottom
      contentContainer.scrollTop = contentContainer.scrollHeight + 10000;

      // Schedule an additional scroll to handle any delayed renders
      requestAnimationFrame(() => {
        if (contentContainer) {
          contentContainer.scrollTop = contentContainer.scrollHeight + 10000;
        }
      });
    }
  };

  // Auto-focus the input field when the component mounts
  useEffect(() => {
    if (inputRef.current) {
      inputRef.current.focus();
    }
  }, []);

  // Trigger scrolling when focus changes
  useEffect(() => {
    const handleFocus = () => triggerScroll();

    if (inputRef.current) {
      inputRef.current.addEventListener("focus", handleFocus);
      return () => {
        if (inputRef.current) {
          inputRef.current.removeEventListener("focus", handleFocus);
        }
      };
    }
  }, []);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!query.trim()) {
      toast.error("Please enter a search query");
      return;
    }

    try {
      const response = await fetch("/api/gemini", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ query }),
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || "Failed to extract parameters");
      }

      const params = await response.json();
      onSubmit(query, params);
      setQuery(""); // Clear input after submitting

      // Trigger scroll after submitting
      setTimeout(triggerScroll, 50);
      setTimeout(triggerScroll, 200);
    } catch (error) {
      console.error("Error processing search:", error);
      toast.error("Failed to process search query");
    }
  };

  // Also handle input changes to ensure auto-scrolling
  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setQuery(e.target.value);
    triggerScroll();
  };

  return (
    <form onSubmit={handleSubmit} className="w-full max-w-4xl">
      <div className="relative">
        <input
          ref={inputRef}
          type="text"
          value={query}
          onChange={handleInputChange}
          placeholder="Ask about movies, theaters, or showtimes..."
          className="w-full p-3.5 pl-4 pr-14 border border-gray-300 rounded-2xl text-gray-800 bg-white focus:outline-none focus:ring-1 focus:ring-gray-300 focus:border-gray-300 shadow-sm text-sm"
          disabled={isProcessing}
        />
        <button
          type="submit"
          className="absolute right-1.5 bottom-1.5 p-2 text-gray-500 hover:text-gray-700 rounded-xl disabled:opacity-40 disabled:cursor-not-allowed flex items-center justify-center"
          disabled={isProcessing || !query.trim()}
          onClick={triggerScroll}
        >
          {isProcessing ? (
            <div className="animate-spin h-5 w-5 border-t-2 border-b-2 border-gray-600 rounded-full"></div>
          ) : (
            <svg
              xmlns="http://www.w3.org/2000/svg"
              viewBox="0 0 24 24"
              fill="currentColor"
              className="w-5 h-5"
              aria-hidden="true"
            >
              <path d="M3.478 2.405a.75.75 0 00-.926.94l2.432 7.905H13.5a.75.75 0 010 1.5H4.984l-2.432 7.905a.75.75 0 00.926.94 60.519 60.519 0 0018.445-8.986.75.75 0 000-1.218A60.517 60.517 0 003.478 2.405z" />
            </svg>
          )}
        </button>
      </div>
    </form>
  );
}
