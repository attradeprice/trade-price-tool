// src/QuoteTable.jsx
import React from 'react';

export default function QuoteTable({ materials, onAddToCart }) {
  const handleSelectionChange = (materialId, selectedOptionId) => {
    onAddToCart(materialId, selectedOptionId);
  };

  return (
    <div className="mt-8">
      <h2 className="text-xl font-semibold mb-4">Your Generated Plan</h2>
      <table className="w-full border rounded overflow-hidden text-sm">
        <thead className="bg-gray-100 text-left">
          <tr>
            <th className="p-2">Product</th>
            <th className="p-2">Quantity</th>
            <th className="p-2">Unit Price (£)</th>
            <th className="p-2">Total Price (£)</th>
          </tr>
        </thead>
        <tbody>
          {materials.map((item) => (
            <tr key={item.id} className="border-t">
              <td className="p-2">
                {item.options?.length > 1 ? (
                  <select
                    className="w-full border rounded px-2 py-1"
                    onChange={(e) => handleSelectionChange(item.id, e.target.value)}
                  >
                    <option disabled selected>
                      Select an option
                    </option>
                    {item.options.map((option) => (
                      <option key={option.id} value={option.id}>
                        {option.name}
                      </option>
                    ))}
                  </select>
                ) : (
                  item.name
                )}
              </td>
              <td className="p-2">{item.quantity} {item.unit}</td>
              <td className="p-2">
                <input
                  type="number"
                  step="0.01"
                  placeholder="0.00"
                  className="w-20 px-2 py-1 border rounded"
                  onChange={(e) => handleSelectionChange(item.id, e.target.value)}
                />
              </td>
              <td className="p-2">0.00</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
