// src/QuoteOutput.jsx
import React, { useMemo, useRef, useState, useEffect, useCallback } from 'react';
import html2pdf from 'html2pdf.js';
import QuoteTable from './QuoteTable';
import ConstructionMethod from './ConstructionMethod';
import CustomerQuote from './CustomerQuote';

export default function QuoteOutput({ quote, setQuote, onAddToCart, selectedTier = 1 }) {
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
      const unitPrice = parseFloat(item.unitPrice || 0);
      return sum + unitPrice * item.quantity;
    }, 0);
  }, [quote]);

  const downloadPdf = () => {
    if (!printRef.current) return;
    html2pdf()
      .set({
        margin: 0.5,
        filename: `${quote.customerQuote?.quoteNumber || 'quote'}.pdf`,
        html2canvas: { scale: 2 },
      })
      .from(printRef.current)
      .save();
  };

  // 🎯 NEW: build and send cart params
  const sendToCart = useCallback(() => {
    const params = new URLSearchParams();
    let idx = 1;
    const selected = quote.selectedMaterials || {};
    Object.entries(selected).forEach(([matId, productName]) => {
      const mat = quote.materials.find(m => String(m.id) === String(matId));
      if (!mat) return;
      params.append(`item_${idx}_name`, productName);
      params.append(`item_${idx}_qty`, mat.quantity);
      idx++;
    });
    window.location.href = `/quote-cart?${params.toString()}`;
  }, [quote.materials, quote.selectedMaterials]);

  const handleLoadSavedQuote = (key) => {
    const saved = localStorage.getItem(key);
    if (saved) {
      setQuote(JSON.parse(saved));
      setSelectedQuoteKey(key);
    }
  };

  const handleDeleteSavedQuote = (key) => {
    localStorage.removeItem(key);
    const updated = savedQuotes.filter(k => k !== key);
    setSavedQuotes(updated);
    setSelectedQuoteKey('');
    if (quote?.customerQuote?.quoteNumber && key.includes(quote.customerQuote.quoteNumber)) {
      setQuote(null);
    }
  };

  if (!quote) return null;

  return (
    <div className="bg-white p-6 mt-6 shadow-lg rounded-lg space-y-8">
      <div className="flex items-center justify-between flex-wrap gap-4">
        <h2 className="text-2xl font-bold text-gray-800">Generated Quote</h2>
        <div className="flex gap-2 flex-wrap items-center">
          <button
            onClick={downloadPdf}
            className="bg-[#275262] hover:bg-[#1e3d4f] text-white px-4 py-2 rounded"
          >
            Download PDF
          </button>
          <button
            onClick={sendToCart}
            className="bg-green-600 hover:bg-green-700 text-white px-4 py-2 rounded"
          >
            Send to Quote Cart
          </button>

          {savedQuotes.length > 0 && (
            <>
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

              {selectedQuoteKey && (
                <button
                  onClick={() => handleDeleteSavedQuote(selectedQuoteKey)}
                  className="bg-red-600 hover:bg-red-700 text-white px-3 py-2 rounded text-sm"
                >
                  Delete Quote
                </button>
              )}
            </>
          )}
        </div>
      </div>

      <div ref={printRef} className="space-y-10">
        {selectedTier >= 1 && (
          <section>
            <h3 className="text-xl font-semibold text-gray-700 mb-4">Tier 1: Materials</h3>
            <QuoteTable
              materials={quote.materials}
              totalCost={totalMaterialsCost}
              selectedMaterials={quote.selectedMaterials || {}}
              onAddToCart={(id, selectedOption) => {
                const updated = {
                  ...(quote.selectedMaterials || {}),
                  [id]: selectedOption,
                };
                const updatedQuote = { ...quote, selectedMaterials: updated };
                setQuote(updatedQuote);
                onAddToCart(id, selectedOption);
              }}
            />
          </section>
        )}

        {selectedTier >= 2 && quote.method && (
          <section>
            <h3 className="text-xl font-semibold text-gray-700 mb-4">Tier 2: Method & Considerations</h3>
            <ConstructionMethod method={quote.method} />
          </section>
        )}

        {selectedTier === 3 && quote.customerQuote && (
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
