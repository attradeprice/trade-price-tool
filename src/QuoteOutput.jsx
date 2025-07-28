// src/QuoteOutput.jsx
import React, { useMemo, useRef, useState, useEffect } from 'react';
import html2pdf from 'html2pdf.js';
import QuoteTable from './QuoteTable';
import ConstructionMethod from './ConstructionMethod';
import CustomerQuote from './CustomerQuote';

export default function QuoteOutput({ quote, onAddToCart, setQuote }) {
  const printRef = useRef();
  const [savedQuotes, setSavedQuotes] = useState([]);
  const [selectedQuoteKey, setSelectedQuoteKey] = useState('');

  useEffect(() => {
    const keys = Object.keys(localStorage).filter(k => k.startsWith('quote_Q-'));
    setSavedQuotes(keys);
  }, [quote]);

  const totalMaterialsCost = useMemo(() => {
    if (!quote?.materials) return 0;
    return quote.materials.reduce((sum, item) => {
      const price = parseFloat(item.unitPrice || 0);
      return sum + price * item.quantity;
    }, 0);
  }, [quote]);

  const downloadPdf = () => {
    if (!printRef.current) return;
    html2pdf()
      .set({ margin: 0.5, filename: `${quote.customerQuote?.quoteNumber || 'quote'}.pdf`, html2canvas: { scale: 2 } })
      .from(printRef.current)
      .save();
  };

  const handleLoadSavedQuote = (key) => {
    const saved = localStorage.getItem(key);
    if (saved) {
      setQuote(JSON.parse(saved));
      setSelectedQuoteKey(key);
    }
  };

  if (!quote) return null;

  return (
    <div className="bg-white p-6 mt-6 shadow-lg rounded-lg space-y-8">
      <div className="flex items-center justify-between">
        <h2 className="text-2xl font-bold text-gray-800">Generated Quote</h2>
        <div className="flex gap-4">
          <button
            onClick={downloadPdf}
            className="bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded"
          >
            Download PDF
          </button>
          {savedQuotes.length > 0 && (
            <select
              value={selectedQuoteKey}
              onChange={(e) => handleLoadSavedQuote(e.target.value)}
              className="border px-3 py-2 rounded text-sm"
            >
              <option value="">Load Saved Quote</option>
              {savedQuotes.map(k => (
                <option key={k} value={k}>{k.replace('quote_', '')}</option>
              ))}
            </select>
          )}
        </div>
      </div>

      <div ref={printRef} className="space-y-10">
        <section>
          <h3 className="text-xl font-semibold text-gray-700 mb-4">Tier 1: Materials</h3>
          <QuoteTable
            materials={quote.materials}
            totalCost={totalMaterialsCost}
            onAddToCart={onAddToCart}
          />
        </section>

        {quote.method && (
          <section>
            <h3 className="text-xl font-semibold text-gray-700 mb-4">Tier 2: Method & Considerations</h3>
            <ConstructionMethod method={quote.method} />
          </section>
        )}

        {quote.customerQuote && (
          <section>
            <h3 className="text-xl font-semibold text-gray-700 mb-4">Tier 3: Final Quote Summary</h3>
            <CustomerQuote
              customerQuote={quote.customerQuote}
              totalMaterialsCost={totalMaterialsCost}
            />
          </section>
        )}
      </div>
    </div>
  );
}
