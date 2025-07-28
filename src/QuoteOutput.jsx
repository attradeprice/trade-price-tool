// src/QuoteOutput.jsx
import React from 'react';
import QuoteTable from './QuoteTable';

export default function QuoteOutput({ quote, onAddToCart }) {
  if (!quote || !quote.materials || quote.materials.length === 0) {
    return null;
  }

  return (
    <div className="bg-white p-6 rounded-lg shadow-lg mt-6">
      <h2 className="text-2xl font-bold text-gray-800 mb-4">Generated Quote</h2>
      <QuoteTable materials={quote.materials} onAddToCart={onAddToCart} />

      {quote.method?.steps?.length > 0 && (
        <div className="mt-6">
          <h3 className="text-lg font-semibold text-gray-700 mb-2">Method Steps</h3>
          <ol className="list-decimal pl-5 text-gray-600 space-y-1">
            {quote.method.steps.map((step, index) => (
              <li key={index}>{step}</li>
            ))}
          </ol>
        </div>
      )}

      {quote.method?.considerations?.length > 0 && (
        <div className="mt-6">
          <h3 className="text-lg font-semibold text-gray-700 mb-2">Considerations</h3>
          <ul className="list-disc pl-5 text-gray-600 space-y-1">
            {quote.method.considerations.map((note, index) => (
              <li key={index}>{note}</li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}
