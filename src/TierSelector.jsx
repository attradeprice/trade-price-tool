// src/TierSelector.jsx
import React from 'react';

const tiers = [
  {
    id: 1,
    title: 'Tier 1: Material List',
    description: 'Generates a complete list of required materials and quantities.',
  },
  {
    id: 2,
    title: 'Tier 2: Full Method & Plan',
    description: 'Includes Tier 1 plus a detailed, step-by-step construction guide.',
  },
  {
    id: 3,
    title: 'Tier 3: Customer-Ready Quote',
    description: 'Includes Tier 2 plus a professional quote with estimated labour costs.',
  },
];

export default function TierSelector({ selectedTier, setSelectedTier }) {
  return (
    <div className="bg-white p-6 rounded-lg shadow-md space-y-4">
      <h2 className="text-lg font-bold text-gray-800">3. Select Your Service Tier</h2>
      <div className="space-y-3">
        {tiers.map((tier) => (
          <div
            key={tier.id}
            className={`border rounded p-4 cursor-pointer transition-all duration-200 ${
              selectedTier === tier.id
                ? 'bg-teal-50 border-teal-600'
                : 'hover:bg-gray-50'
            }`}
            onClick={() => setSelectedTier(tier.id)}
          >
            <h3 className="font-semibold text-teal-900 flex items-center gap-2">
              {tier.title}
            </h3>
            <p className="text-sm text-gray-600">{tier.description}</p>
          </div>
        ))}
      </div>
    </div>
  );
}
