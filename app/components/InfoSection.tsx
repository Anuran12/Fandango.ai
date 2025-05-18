"use client";

import { useState } from "react";

export default function InfoSection() {
  const [isExpanded, setIsExpanded] = useState(true);

  return (
    <div className="w-full max-w-3xl my-4 flex justify-start">
      <div className="bg-gray-50 rounded-lg p-4 text-sm text-gray-700 border border-gray-100 max-w-[92%]">
        <div className="flex justify-between items-center mb-2">
          <h2 className="text-base font-medium text-gray-800">
            How to use this app
          </h2>
          <button
            onClick={() => setIsExpanded(!isExpanded)}
            className="text-gray-500 hover:text-gray-700 focus:outline-none text-xs"
          >
            {isExpanded ? "Hide" : "Show"}
          </button>
        </div>

        {isExpanded && (
          <div className="text-gray-700">
            <ol className="list-decimal pl-5 space-y-2 mb-3">
              <li>
                Type a natural language query about movies showing at theaters
              </li>
              <li>
                The app will extract movie, theater, location, and time
                parameters
              </li>
              <li>Results will be displayed with movie showtimes and images</li>
            </ol>

            <p className="font-medium mt-4 mb-2">Example queries:</p>
            <ul className="list-disc pl-5 space-y-1 text-gray-600">
              <li>&#34;Show me showtimes for Dune in Chicago&#34;</li>
              <li>
                &#34;What movies are playing at AMC theaters in New York after
                7pm?&#34;
              </li>
              <li>
                &#34;Find family movies at Regal Cinema in Los Angeles&#34;
              </li>
            </ul>
          </div>
        )}
      </div>
    </div>
  );
}
