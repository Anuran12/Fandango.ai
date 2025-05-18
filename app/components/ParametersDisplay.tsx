"use client";

import { type ScraperQuery } from "@/lib/fandangoScraper";
import { useEffect, useState } from "react";

interface ParametersDisplayProps {
  params: ScraperQuery | null;
}

export default function ParametersDisplay({ params }: ParametersDisplayProps) {
  const [isVisible, setIsVisible] = useState(false);

  useEffect(() => {
    if (params) {
      // Small delay before showing the element for transition effect
      const timer = setTimeout(() => {
        setIsVisible(true);
      }, 100);

      return () => clearTimeout(timer);
    } else {
      setIsVisible(false);
    }
  }, [params]);

  if (!params || Object.keys(params).length === 0) {
    return null;
  }

  return (
    <div
      className={`w-full my-3 transition-opacity duration-300 ${
        isVisible ? "opacity-100" : "opacity-0"
      }`}
    >
      <div className="bg-gray-50 rounded-lg p-4 text-sm text-gray-700 border border-gray-100">
        <h2 className="text-base font-medium mb-2 text-gray-800">
          Extracted Parameters
        </h2>
        <div className="bg-white p-3 rounded border border-gray-200">
          <pre className="text-xs overflow-x-auto text-gray-700 whitespace-pre-wrap">
            {JSON.stringify(params, null, 2)}
          </pre>
        </div>
      </div>
    </div>
  );
}
