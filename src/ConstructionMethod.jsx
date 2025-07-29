// src/ConstructionMethod.jsx
import React from 'react';

export default function ConstructionMethod({ method }) {
  if (!method) return null;

  const { steps = [], considerations = [] } = method;

  return (
    <div className="space-y-6">
      <div>
        <h4 className="text-lg font-semibold text-gray-800 mb-2">Step-by-Step Guide</h4>
        <ol className="list-decimal list-inside space-y-2 text-gray-700">
          {steps.map((step, idx) => (
            <li key={idx}>{step}</li>
          ))}
        </ol>
      </div>

      {considerations.length > 0 && (
        <div className="p-4 border border-yellow-300 bg-yellow-50 rounded-md text-sm">
          <h5 className="font-semibold text-yellow-800 mb-1">Important Considerations</h5>
          <ul className="list-disc pl-5 text-yellow-800">
            {considerations.map((note, idx) => (
              <li key={idx}>{note}</li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}
