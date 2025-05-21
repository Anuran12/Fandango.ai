"use client";

import { useState } from "react";
import styles from "../theme.module.css";

export default function InfoSection() {
  const [isExpanded, setIsExpanded] = useState(true);

  return (
    <div className="w-full max-w-3xl my-6 flex justify-start">
      <div className={`${styles.gradientCard} w-full p-5`}>
        <div className="flex justify-between items-center mb-3">
          <h2 className={`${styles.gradientText} text-lg`}>
            How to use this app
          </h2>
          <button
            onClick={() => setIsExpanded(!isExpanded)}
            className={`${styles.gradientButton} px-3 py-1 text-xs`}
          >
            {isExpanded ? "Hide" : "Show"}
          </button>
        </div>

        {isExpanded && (
          <div className="text-gray-700">
            <ol className="list-decimal pl-5 space-y-3 mb-4">
              <li>
                Type a natural language query about movies showing at theaters
              </li>
              <li>
                The app will extract movie, theater, location, and time
                parameters
              </li>
              <li>Results will be displayed with movie showtimes and images</li>
            </ol>

            <p className="font-medium mt-5 mb-3">Example queries:</p>
            <ul className="list-disc pl-5 space-y-2 text-gray-600">
              <li className="hover:text-blue-600 transition-colors cursor-pointer">
                &ldquo;Show me showtimes for Dune in Chicago&rdquo;
              </li>
              <li className="hover:text-blue-600 transition-colors cursor-pointer">
                &ldquo;What movies are playing at AMC theaters in New York after
                7pm?&rdquo;
              </li>
              <li className="hover:text-blue-600 transition-colors cursor-pointer">
                &ldquo;Find family movies at Regal Cinema in Los Angeles&rdquo;
              </li>
            </ul>
          </div>
        )}
      </div>
    </div>
  );
}
