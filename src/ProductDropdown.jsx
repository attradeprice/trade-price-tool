// src/ProductDropdown.jsx
import React from 'react';

export default function ProductDropdown({ options, value, onChange }) {
  return (
    <select
      className="border p-2 rounded bg-white shadow-sm"
      value={value}
      onChange={(e) => onChange(e.target.value)}
    >
      {options.map((opt) => (
        <option key={opt.id} value={opt.name}>
          {opt.name}
        </option>
      ))}
    </select>
  );
}
