// src/GenerateButton.jsx
import React from 'react';

export default function GenerateButton({ loading, onClick }) {
  return (
    <div className="flex justify-center mt-6">
      <button
        className="bg-teal-700 text-white px-6 py-3 rounded-lg font-semibold hover:bg-teal-800 transition disabled:opacity-50"
        onClick={onClick}
        disabled={loading}
      >
        {loading ? 'Generating...' : '⚡ Generate Plan'}
      </button>
    </div>
  );
} 
