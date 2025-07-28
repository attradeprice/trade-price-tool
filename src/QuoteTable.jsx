import React from 'react';
import ProductDropdown from './ProductDropdown';

export default function QuoteTable({ materials = [], totalCost, onAddToCart }) {
  return (
    <div className="overflow-x-auto border rounded-lg">
      <table className="min-w-full text-sm text-gray-800">
        <thead className="bg-gray-100 text-gray-700 uppercase text-xs font-semibold">
          <tr>
            <th className="text-left px-4 py-3">Material</th>
            <th className="text-center px-4 py-3">Qty</th>
            <th className="text-center px-4 py-3">Unit</th>
            <th className="text-right px-4 py-3">Action</th>
          </tr>
        </thead>
        <tbody>
          {materials.map((item) => (
            <tr key={item.id} className="border-b hover:bg-gray-50">
              <td className="px-4 py-2">
                <div className="font-medium">
                  {item.name}
                </div>
                {item.options?.length > 0 && (
                  <ProductDropdown
                    options={item.options}
                    value={item.options[0]?.name}
                    onChange={(val) => onAddToCart(item.id, val)}
                  />
                )}
              </td>
              <td className="px-4 py-2 text-center">{item.quantity}</td>
              <td className="px-4 py-2 text-center">{item.unit}</td>
              <td className="px-4 py-2 text-right">
                {item.options?.length === 0 && (
                  <span className="text-gray-400 italic">To be quoted</span>
                )}
              </td>
            </tr>
          ))}
        </tbody>
        <tfoot>
          <tr className="bg-gray-100 font-semibold">
            <td colSpan="3" className="text-right px-4 py-3">Subtotal</td>
            <td className="text-right px-4 py-3 text-brand">£{totalCost.toFixed(2)}</td>
          </tr>
        </tfoot>
      </table>
    </div>
  );
}
