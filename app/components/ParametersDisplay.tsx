"use client";

interface ParametersDisplayProps {
  params: any;
}

export default function ParametersDisplay({ params }: ParametersDisplayProps) {
  if (!params || Object.keys(params).length === 0) {
    return null;
  }

  return (
    <div className="w-full max-w-3xl bg-white rounded-lg shadow-md p-6 my-4">
      <h2 className="text-xl font-bold mb-4 text-gray-800">
        Extracted Parameters
      </h2>
      <div className="bg-gray-100 p-4 rounded-md">
        <pre className="text-sm overflow-x-auto text-gray-800 whitespace-pre-wrap">
          {JSON.stringify(params, null, 2)}
        </pre>
      </div>
    </div>
  );
}
