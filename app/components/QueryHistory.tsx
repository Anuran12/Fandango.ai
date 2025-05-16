"use client";

interface QueryHistoryProps {
  queries: string[];
  onSelect: (query: string) => void;
}

export default function QueryHistory({ queries, onSelect }: QueryHistoryProps) {
  if (!queries || queries.length === 0) {
    return null;
  }

  return (
    <div className="w-full bg-white rounded-lg shadow-md p-4">
      <h3 className="text-lg font-medium mb-3 text-gray-800">Query History</h3>
      <div className="space-y-2">
        {queries.map((query, index) => (
          <button
            key={index}
            onClick={() => onSelect(query)}
            className="w-full text-left px-4 py-2 bg-gray-100 hover:bg-gray-200 rounded-md text-sm truncate"
            title={query}
          >
            {query}
          </button>
        ))}
      </div>
    </div>
  );
}
