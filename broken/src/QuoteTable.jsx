import React, { useState } from 'react';
import ProductDropdown from './ProductDropdown';

export default function QuoteTable({ materials = [], totalCost, onAddToCart }) {
  const [selections, setSelections] = useState({});

  const handleSelect = (id, name) => {
    const updated = { ...selections, [id]: name };
    setSelections(updated);
  };

  const handleAdd = (id) => {
    if (selections[id]) onAddToCart(id, selections[id]);
  };

  return (
    <table className="w-full text-sm border">
      <thead className="bg-gray-100 text-gray-700">
        <tr>
          <th className="text-left p-2">Material</th>
          <th className="text-center p-2">Qty</th>
          <th className="text-center p-2">Unit</th>
          <th className="text-center p-2">Action</th>
        </tr>
      </thead>
      <tbody>
        {materials.map((item) => (
          <tr key={item.id} className="border-b">
            <td className="p-2 align-top">
              {item.options?.length ? (
                <ProductDropdown
                  options={item.options}
                  value={selections[item.id] || item.options[0]?.name}
                  onChange={(val) => handleSelect(item.id, val)}
                />
              ) : (
                item.name
              )}
            </td>
            <td className="text-center p-2 align-top">{item.quantity}</td>
            <td className="text-center p-2 align-top">{item.unit}</td>
            <td className="text-center p-2 align-top">
              {item.options?.length ? (
                <button
                  onClick={() => handleAdd(item.id)}
                  className="text-xs px-3 py-1 bg-[#275262] text-white rounded hover:opacity-90"
                >
                  Add to Cart
                </button>
              ) : (
                <span className="text-gray-400 text-xs">(to be quoted)</span>
              )}
            </td>
          </tr>
        ))}
        <tr className="bg-gray-50 font-semibold">
          <td colSpan="3" className="p-2 text-right">
            Subtotal
          </td>
          <td className="p-2 text-right">£{(totalCost || 0).toFixed(2)}</td>
        </tr>
      </tbody>
    </table>
  );
}
