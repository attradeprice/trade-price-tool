// src/QuoteTable.jsx
import React from 'react';
import ProductDropdown from './ProductDropdown';

export default function QuoteTable({ materials = [], totalCost, selectedMaterials = {}, onAddToCart }) {
  const handleSelect = (id, product) => {
    onAddToCart(id, product);
  };

  return (
    <table className="w-full text-sm border border-gray-300 rounded overflow-hidden">
      <thead className="bg-gray-100 text-gray-700">
        <tr>
          <th className="text-left p-3 w-1/3">Material</th>
          <th className="text-center p-3">Qty</th>
          <th className="text-center p-3">Unit</th>
          <th className="text-center p-3">Selected Product</th>
          <th className="text-center p-3">Action</th>
        </tr>
      </thead>
      <tbody>
        {materials.map((item) => {
          const selected = selectedMaterials[item.name];

          return (
            <tr key={item.name} className="border-t border-gray-200">
              <td className="p-3">
                <ProductDropdown
                  selectedProduct={selected}
                  onSelect={(product) => handleSelect(item.name, product)}
                />
              </td>
              <td className="text-center p-3">{item.quantity}</td>
              <td className="text-center p-3">{item.unit}</td>
              <td className="text-center p-3">
                {selected ? (
                  <div className="flex items-center justify-center gap-2">
                    <img
                      src={selected.image}
                      alt={selected.name}
                      className="w-8 h-8 rounded object-cover"
                    />
                    <span className="text-gray-800 text-sm">{selected.name}</span>
                  </div>
                ) : (
                  <span className="text-gray-400 text-xs italic">No selection</span>
                )}
              </td>
              <td className="text-center p-3">
                <button
                  onClick={() => selected && onAddToCart(item.name, selected)}
                  className={`text-xs px-3 py-1 rounded ${
                    selected
                      ? 'bg-[#275262] text-white hover:opacity-90'
                      : 'bg-gray-300 text-gray-600 cursor-not-allowed'
                  }`}
                  disabled={!selected}
                >
                  Add to Cart
                </button>
              </td>
            </tr>
          );
        })}

        <tr className="bg-gray-50 font-semibold border-t">
          <td colSpan="4" className="p-3 text-right">
            Subtotal
          </td>
          <td className="p-3 text-right text-gray-800">£{(totalCost || 0).toFixed(2)}</td>
        </tr>
      </tbody>
    </table>
  );
}
