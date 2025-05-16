"use client";

import { useState } from "react";
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
    } catch (error) {
      console.error("Error processing search:", error);
      toast.error("Failed to process search query");
    }
  };

  return (
    <form onSubmit={handleSubmit} className="w-full max-w-3xl">
      <div className="flex flex-col md:flex-row gap-2">
        <input
          type="text"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="e.g., Show movies playing at AMC in Boston tonight"
          className="flex-grow p-3 border rounded-lg text-gray-800 bg-white focus:outline-none focus:ring-2 focus:ring-blue-500"
          disabled={isProcessing}
        />
        <button
          type="submit"
          className="px-6 py-3 bg-blue-600 text-white font-medium rounded-lg hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-500 disabled:opacity-50 disabled:cursor-not-allowed"
          disabled={isProcessing || !query.trim()}
        >
          {isProcessing ? "Processing..." : "Search"}
        </button>
      </div>
    </form>
  );
}
