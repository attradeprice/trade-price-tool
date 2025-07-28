import React, { useState } from 'react';
import { ChevronDown } from 'lucide-react';

const cleanTitle = (title) => {
  return title.replace(/\d{3,4}x\d{3,4}(x\d+)?(mm|cm|m)?/gi, '').trim();
};

export default function ProductDropdown({ options = [], value, onChange }) {
  const [open, setOpen] = useState(false);

  const selected = options.find(opt => cleanTitle(opt.name) === cleanTitle(value)) || options[0];

  return (
    <div className="relative w-full">
      <button
        type="button"
        onClick={() => setOpen(prev => !prev)}
        className="w-full bg-white border border-gray-300 rounded px-4 py-2 flex justify-between items-center shadow-sm hover:border-gray-400"
      >
        <div className="flex items-center gap-2">
          {selected?.image && (
            <img
              src={selected.image}
              alt={selected.name}
              className="w-8 h-8 object-cover rounded"
            />
          )}
          <span className="truncate">{cleanTitle(selected.name)}</span>
        </div>
        <ChevronDown size={16} className={`${open ? 'rotate-180' : ''} transition-transform`} />
      </button>

      {open && (
        <ul className="absolute z-20 mt-1 w-full max-h-60 overflow-auto bg-white border border-gray-300 rounded shadow-md">
          {options.map(opt => (
            <li
              key={opt.id}
              className="px-4 py-2 hover:bg-gray-100 cursor-pointer flex items-center gap-2"
              onClick={() => {
                onChange(cleanTitle(opt.name));
                setOpen(false);
              }}
            >
              {opt.image && (
                <img src={opt.image} alt={opt.name} className="w-6 h-6 object-cover rounded" />
              )}
              <span className="truncate">{cleanTitle(opt.name)}</span>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
