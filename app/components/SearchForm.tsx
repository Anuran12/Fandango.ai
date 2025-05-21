"use client";

import { useState, useRef, useEffect } from "react";
import { toast } from "react-hot-toast";
import { type ScraperQuery } from "@/lib/fandangoScraper";
import styles from "./searchform.module.css";

interface SearchFormProps {
  onSubmit: (query: string, params: ScraperQuery) => void;
  isProcessing: boolean;
}

export default function SearchForm({
  onSubmit,
  isProcessing,
}: SearchFormProps) {
  const [query, setQuery] = useState("");
  const [searchFinished, setSearchFinished] = useState(false);
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

  // Reset search finished state when query changes
  useEffect(() => {
    if (query) {
      setSearchFinished(false);
    }
  }, [query]);

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

      // Mark search as finished
      setSearchFinished(true);

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

  const hasInputValue = query.trim().length > 0;

  return (
    <form onSubmit={handleSubmit} className="w-full max-w-4xl">
      <div className={styles.container}>
        <div className={styles.searchContainer}>
          <input
            ref={inputRef}
            type="text"
            value={query}
            onChange={handleInputChange}
            placeholder="What else can I help with?"
            className={styles.input}
            disabled={isProcessing}
          />

          {/* Show search finished tag after search completion */}
          {searchFinished && !isProcessing && (
            <div className={styles.button}>
              <span>search finished</span>
              <svg
                xmlns="http://www.w3.org/2000/svg"
                fill="none"
                viewBox="0 0 24 24"
                stroke="currentColor"
                className={styles.icon}
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M14 5l7 7m0 0l-7 7m7-7H3"
                />
              </svg>
            </div>
          )}

          {/* Show send button, disabled when empty */}
          {!searchFinished && !isProcessing && (
            <button
              type="submit"
              className={`${styles.sendButton} ${
                !hasInputValue ? styles.disabled : ""
              }`}
              onClick={triggerScroll}
              aria-label="Send"
              disabled={!hasInputValue}
            >
              <svg
                className={styles.sendIcon}
                viewBox="0 0 1024 1024"
                version="1.1"
                xmlns="http://www.w3.org/2000/svg"
              >
                <path d="M0 950.857143l1024-438.857143L0 73.142857v341.333333l731.428571 97.52381-731.428571 97.52381z" />
              </svg>
            </button>
          )}

          {/* Show spinner when processing */}
          {isProcessing && (
            <div className={styles.spinner}>
              <div className="animate-spin h-5 w-5 border-t-2 border-b-2 border-blue-600 rounded-full"></div>
            </div>
          )}
        </div>
      </div>
    </form>
  );
}
