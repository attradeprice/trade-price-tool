// src/GenerateButton.jsx
import React from 'react';

export default function GenerateButton({ loading, onClick }) {
  return (
    <div className="flex justify-center mt-6">
      <button
        type="button"
        className="bg-teal-700 text-white px-6 py-3 rounded-lg font-semibold hover:bg-teal-800 transition disabled:opacity-50 flex items-center gap-2 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-teal-500"
        onClick={onClick}
        disabled={loading}
        aria-busy={loading}
        aria-label="Generate project plan and quote"
      >
        {loading && (
          <svg
            className="animate-spin h-5 w-5 text-white"
            xmlns="http://www.w3.org/2000/svg"
            fill="none"
            viewBox="0 0 24 24"
          >
            <circle
              className="opacity-25"
              cx="12"
              cy="12"
              r="10"
              stroke="currentColor"
              strokeWidth="4"
            />
            <path
              className="opacity-75"
              fill="currentColor"
              d="M4 12a8 8 0 018-8v4l3-3-3-3v4a8 8 0 00-8 8z"
            />
          </svg>
        )}
        {loading ? 'Generating...' : '⚡ Generate Plan'}
      </button>
    </div>
  );
}
