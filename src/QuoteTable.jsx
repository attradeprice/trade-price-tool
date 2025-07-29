// src/QuoteTable.jsx
import React from 'react';
import ProductDropdown from './ProductDropdown';

export default function QuoteTable({ materials = [], totalCost, selectedMaterials = {}, onAddToCart }) {
  const handleSelect = (id, product) => {
    onAddToCart(id, product); // Update global quote state
  };

  return (
    <table className="w-full text-sm border">
      <thead className="bg-gray-100 text-gray-700">
        <tr>
          <th className="text-left p-2 w-1/2">Material</th>
          <th className="text-center p-2">Qty</th>
          <th className="text-center p-2">Unit</th>
          <th className="text-center p-2">Selected Product</th>
        </tr>
      </thead>
      <tbody>
        {materials.map((item) => {
          const selected = selectedMaterials[item.name];

          return (
            <tr key={item.name} className="border-b align-top">
              <td className="p-2">
                <ProductDropdown
                  selectedProduct={selected}
                  onSelect={(product) => handleSelect(item.name, product)}
                />
              </td>
              <td className="text-center p-2">{item.quantity}</td>
              <td className="text-center p-2">{item.unit}</td>
              <td className="text-center p-2">
                {selected ? (
                  <div className="flex items-center justify-center gap-2">
                    <img
                      src={selected.image}
                      alt={selected.name}
                      className="w-8 h-8 rounded object-cover"
                    />
                    <span>{selected.name}</span>
                  </div>
                ) : (
                  <span className="text-gray-400 text-xs">No selection</span>
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
