import React, { useState } from 'react';

function ProductDropdown({ options, value, onChange }) {
  const [open, setOpen] = useState(false);
  const selected = options.find(opt => opt.name === value) || options[0];

  return (
    <div className="relative">
      <button
        type="button"
        onClick={() => setOpen(!open)}
        className="w-full p-2 border rounded flex items-center bg-white"
      >
        {selected.image && (
          <img
            src={selected.image}
            alt={selected.name}
            className="w-6 h-6 mr-2 object-cover rounded"
          />
        )}
        <span>{selected.name}</span>
      </button>
      {open && (
        <ul className="absolute z-10 mt-1 w-full bg-white border rounded shadow-lg max-h-60 overflow-auto">
          {options.map(opt => (
            <li
              key={opt.id}
              onClick={() => {
                onChange(opt.name);
                setOpen(false);
              }}
              className="p-2 hover:bg-gray-100 cursor-pointer flex items-center"
            >
              {opt.image && (
                <img
                  src={opt.image}
                  alt={opt.name}
                  className="w-6 h-6 mr-2 object-cover rounded"
                />
              )}
              <span>{opt.name}</span>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

export default ProductDropdown;
