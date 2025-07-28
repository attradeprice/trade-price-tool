// src/ProductDropdown.jsx
import React, { useState, useEffect } from 'react';

export default function ProductDropdown({ options = [], value = '', onChange }) {
  const [selected, setSelected] = useState(value);

  useEffect(() => {
    setSelected(value);
  }, [value]);

  const handleChange = (newVal) => {
    setSelected(newVal);
    onChange(newVal);
  };

  return (
    <div className="w-full space-y-2">
      <select
        className="w-full border text-sm rounded p-2 shadow-sm bg-white text-gray-800 focus:ring-2 focus:ring-[#275262]"
        value={selected}
        onChange={(e) => handleChange(e.target.value)}
      >
        {options.map((opt, i) => (
          <option key={i} value={opt.name}>
            {opt.name}
          </option>
        ))}
      </select>

      <div className="flex flex-wrap gap-3 mt-2">
        {options.map((opt, i) => (
          <div
            key={i}
            onClick={() => handleChange(opt.name)}
            className={`cursor-pointer border rounded w-20 h-20 overflow-hidden transition-all flex items-center justify-center ${
              opt.name === selected
                ? 'ring-2 ring-[#275262] bg-gray-50'
                : 'hover:ring-1 hover:ring-[#275262]/40'
            }`}
            title={opt.name}
            aria-label={opt.name}
          >
            {opt.image ? (
              <img
                src={opt.image}
                alt={opt.name}
                className="w-full h-full object-cover"
              />
            ) : (
              <div className="text-[10px] text-gray-500 text-center px-1">
                No image
              </div>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}
