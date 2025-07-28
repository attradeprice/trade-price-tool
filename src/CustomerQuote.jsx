import React from 'react';

export default function CustomerQuote({ customerQuote, totalMaterialsCost }) {
  if (!customerQuote) return null;

  const {
    quoteNumber,
    date,
    projectDescription,
    labourCost = 0,
    vat = 0,
    total = 0,
  } = customerQuote;

  return (
    <div className="bg-white border rounded-lg p-6 shadow">
      <div className="mb-4">
        <h4 className="text-lg font-bold text-gray-800">Quote Summary</h4>
        <p className="text-sm text-gray-600">Quote #: {quoteNumber} — Date: {date}</p>
      </div>

      <p className="text-gray-700 mb-4"><strong>Description:</strong> {projectDescription}</p>

      <table className="w-full text-sm border rounded overflow-hidden">
        <tbody>
          <tr className="border-t">
            <td className="p-2">Materials</td>
            <td className="p-2 text-right">£{totalMaterialsCost.toFixed(2)}</td>
          </tr>
          <tr className="border-t">
            <td className="p-2">Estimated Labour</td>
            <td className="p-2 text-right">£{labourCost.toFixed(2)}</td>
          </tr>
          <tr className="border-t">
            <td className="p-2">VAT</td>
            <td className="p-2 text-right">£{vat.toFixed(2)}</td>
          </tr>
          <tr className="bg-gray-100 font-bold border-t">
            <td className="p-2">Total</td>
            <td className="p-2 text-right text-brand">£{total.toFixed(2)}</td>
          </tr>
        </tbody>
      </table>

      <p className="text-xs text-gray-500 mt-4">
        This quote is valid for 30 days. Labour costs are estimated. Product pricing is subject to merchant verification.
      </p>
    </div>
  );
}
