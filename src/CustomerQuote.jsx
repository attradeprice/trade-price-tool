// src/CustomerQuote.jsx
import React from 'react';

export default function CustomerQuote({ customerQuote, totalMaterialsCost }) {
  if (!customerQuote) return null;

  const labourHours = customerQuote.labourHours || 0;
  const hourlyRate = customerQuote.hourlyRate || 25;
  const vatRate = customerQuote.vatRate ?? 0.2;

  const labourCost = labourHours * hourlyRate;
  const subtotal = totalMaterialsCost + labourCost;
  const vatAmount = subtotal * vatRate;
  const total = subtotal + vatAmount;

  return (
    <div className="space-y-6 text-sm text-[#275262]">
      <div>
        <strong>Quote #:</strong> {customerQuote.quoteNumber}<br />
        <strong>Date:</strong> {customerQuote.date}
      </div>

      <div>
        <strong>Project Description:</strong>
        <p className="mt-1 text-gray-700 whitespace-pre-line">
          {customerQuote.projectDescription ||
            'This quote outlines the work to be carried out based on your request.'}
        </p>
      </div>

      <div>
        <strong>Estimated Labour:</strong>
        <p className="mt-1 text-gray-700">
          {labourHours} hours @ £{hourlyRate}/hr = <strong>£{labourCost.toFixed(2)}</strong>
        </p>
      </div>

      <div className="border-t border-gray-300 pt-4">
        <div className="flex justify-between">
          <span>Materials:</span>
          <span>£{totalMaterialsCost.toFixed(2)}</span>
        </div>
        <div className="flex justify-between">
          <span>Labour:</span>
          <span>£{labourCost.toFixed(2)}</span>
        </div>
        <div className="flex justify-between">
          <span>VAT ({(vatRate * 100).toFixed(0)}%):</span>
          <span>£{vatAmount.toFixed(2)}</span>
        </div>
        <div className="flex justify-between font-bold text-[#275262] border-t pt-2 mt-2">
          <span>Total (inc. VAT):</span>
          <span>£{total.toFixed(2)}</span>
        </div>
      </div>

      <p className="text-xs text-gray-500 mt-2 italic">
        This quote is valid for 30 days. Labour rates and product costs are estimates unless otherwise agreed.
      </p>
    </div>
  );
}
