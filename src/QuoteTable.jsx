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
          <th className="text-left p-2 w-1/2">Material</th>
          <th className="text-center p-2">Qty</th>
          <th className="text-center p-2">Unit</th>
          <th className="text-center p-2">Action</th>
        </tr>
      </thead>
      <tbody>
        {materials.map((item) => {
          const hasOptions = item.options?.length > 0;
          const defaultName = hasOptions ? item.options[0]?.name : item.name;

          return (
            <tr key={item.id} className="border-b align-top">
              <td className="p-2">
                {hasOptions ? (
                  <ProductDropdown
                    options={item.options}
                    value={selections[item.id] || defaultName}
                    onChange={(val) => handleSelect(item.id, val)}
                  />
                ) : (
                  <div className="text-gray-800">{item.name}</div>
                )}
              </td>
              <td className="text-center p-2">{item.quantity}</td>
              <td className="text-center p-2">{item.unit}</td>
              <td className="text-center p-2">
                {hasOptions ? (
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
          );
        })}

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
