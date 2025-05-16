"use client";

import { useState } from "react";

export default function InfoSection() {
  const [isExpanded, setIsExpanded] = useState(true);

  return (
    <div className="w-full max-w-3xl bg-white rounded-lg shadow-md p-6 my-4">
      <div className="flex justify-between items-center mb-2">
        <h2 className="text-xl font-bold text-gray-800">How to use this app</h2>
        <button
          onClick={() => setIsExpanded(!isExpanded)}
          className="text-blue-600 hover:text-blue-800 focus:outline-none"
        >
          {isExpanded ? "Hide" : "Show"}
        </button>
      </div>

      {isExpanded && (
        <div className="prose prose-sm max-w-none text-gray-700">
          <ol className="list-decimal pl-5 space-y-2">
            <li>
              Type a natural language query about movies showing at theaters
            </li>
            <li>
              The app will extract movie, theater, location, and time parameters
            </li>
            <li>Results will be displayed with movie showtimes and images</li>
          </ol>

          <p className="font-medium mt-4">Example queries:</p>
          <ul className="list-disc pl-5 space-y-1">
            <li>"Show me showtimes for Dune in Chicago"</li>
            <li>
              "What movies are playing at AMC theaters in New York after 7pm?"
            </li>
            <li>"Find family movies at Regal Cinema in Los Angeles"</li>
          </ul>
        </div>
      )}
    </div>
  );
}
