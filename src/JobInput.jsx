// src/JobInput.jsx
import React from 'react';

export default function JobInput({ jobDescription, setJobDescription }) {
  return (
    <div className="bg-white p-6 rounded-lg shadow-md">
      <label htmlFor="job-description" className="block text-sm font-medium text-gray-700 mb-2">
        Describe your project
      </label>
      <textarea
        id="job-description"
        rows="4"
        value={jobDescription}
        onChange={(e) => setJobDescription(e.target.value)}
        placeholder="e.g., I want to build a 5x4m natural stone patio on a grass area."
        className="w-full border border-gray-300 p-3 rounded-md focus:outline-none focus:ring-2 focus:ring-brand focus:border-transparent"
      ></textarea>
    </div>
  );
}
