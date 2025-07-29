// src/CustomerQuote.jsx
import React from 'react';

export default function CustomerQuote({ customerQuote, totalMaterialsCost }) {
  if (!customerQuote) return null;

  const labourHours = customerQuote.labourHours || 0;
  const hourlyRate = customerQuote.hourlyRate || 25;
  const labourCost = labourHours * hourlyRate;
  const subtotal = totalMaterialsCost + labourCost;
  const vatAmount = subtotal * (customerQuote.vatRate || 0.2);
  const total = subtotal + vatAmount;

  return (
    <div className="space-y-6 text-sm text-gray-800">
      <div>
        <strong>Quote Number:</strong> {customerQuote.quoteNumber}<br />
        <strong>Date:</strong> {customerQuote.date}
      </div>

      <div>
        <strong>Project Summary:</strong>
        <p className="mt-1 text-gray-700 whitespace-pre-line">
          {customerQuote.projectSummary || 'This quote outlines the work to be carried out based on your description.'}
        </p>
      </div>

      <div>
        <strong>Estimated Labour:</strong>
        <p className="mt-1 text-gray-700">
          {labourHours} hours @ £{hourlyRate}/hr = £{labourCost.toFixed(2)}
        </p>
      </div>

      <div className="border-t pt-4">
        <div className="flex justify-between">
          <span>Materials Total:</span>
          <span>£{totalMaterialsCost.toFixed(2)}</span>
        </div>
        <div className="flex justify-between">
          <span>Labour Cost:</span>
          <span>£{labourCost.toFixed(2)}</span>
        </div>
        <div className="flex justify-between">
          <span>VAT ({(customerQuote.vatRate * 100).toFixed(0)}%):</span>
          <span>£{vatAmount.toFixed(2)}</span>
        </div>
        <div className="flex justify-between font-semibold border-t pt-2 mt-2">
          <span>Total (inc. VAT):</span>
          <span>£{total.toFixed(2)}</span>
        </div>
      </div>
    </div>
  );
}
