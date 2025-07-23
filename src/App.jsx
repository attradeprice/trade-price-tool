import React, { useState, useMemo } from 'react';
import { Zap, FileText, UserCheck, Edit } from 'lucide-react';

// Mock Product Database (now without prices)
// This will be sent to the AI along with the user's prompt.
const MOCK_PRODUCTS = [
  { id: 1, name: 'Kandla Grey Natural Sandstone Paving Slabs', category: 'Paving', type: 'Natural Stone', coverage_per_unit: 0.9, unit: 'm²' },
  { id: 2, name: 'Raj Green Natural Sandstone Paving Slabs', category: 'Paving', type: 'Natural Stone', coverage_per_unit: 0.9, unit: 'm²' },
  { id: 3, name: 'Black Limestone Paving Slabs', category: 'Paving', type: 'Limestone', coverage_per_unit: 0.9, unit: 'm²' },
  { id: 4, name: 'Porcelain Paving Slabs - Anthracite', category: 'Paving', type: 'Porcelain', coverage_per_unit: 1, unit: 'm²' },
  { id: 5, name: 'MOT Type 1 Sub-base', category: 'Aggregate', type: 'Sub-base', coverage_per_unit: 0.02, unit: 'tonne' },
  { id: 6, name: 'Building Sand', category: 'Aggregate', type: 'Sand', coverage_per_unit: 0.025, unit: 'tonne' },
  { id: 7, name: 'Cement', category: 'Aggregate', type: 'Cement', coverage_per_unit: 0.025, unit: 'bag' },
  { id: 8, name: 'vdw 850 Grouting Compound - Basalt', category: 'Pointing', type: 'Compound', coverage_per_unit: 15, unit: 'tub' },
  { id: 9, name: 'vdw 815 Grouting Compound - Natural', category: 'Pointing', type: 'Compound', coverage_per_unit: 15, unit: 'tub' },
  { id: 10, name: 'Geotextile Membrane', category: 'Landscaping Fabric', type: 'Membrane', coverage_per_unit: 1, unit: 'm²'},
];

// --- Helper Components ---

const Card = ({ children, className = '' }) => (
  <div className={`bg-white rounded-xl shadow-lg p-6 sm:p-8 ${className}`}>
    {children}
  </div>
);

const Button = ({ onClick, children, className = '', disabled = false }) => (
  <button
    onClick={onClick}
    disabled={disabled}
    className={`w-full flex items-center justify-center gap-2 rounded-lg px-6 py-3 text-base font-semibold text-white transition-all duration-300 ease-in-out ${
      disabled
        ? 'bg-gray-400 cursor-not-allowed'
        : 'bg-blue-600 hover:bg-blue-700 shadow-md hover:shadow-lg transform hover:-translate-y-0.5'
    } ${className}`}
  >
    {children}
  </button>
);

// --- Core Components ---

const JobInput = ({ jobDescription, setJobDescription }) => (
  <Card>
    <h2 className="text-xl sm:text-2xl font-bold text-gray-800 mb-4">Describe Your Project</h2>
    <p className="text-gray-600 mb-4">
      Provide as much detail as possible. For example: "I want to build a patio on a grass area, 5x4 metres, using natural stone."
    </p>
    <textarea
      value={jobDescription}
      onChange={(e) => setJobDescription(e.target.value)}
      className="w-full h-40 p-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-shadow duration-200"
      placeholder="Enter job description here..."
    />
  </Card>
);

const TierSelector = ({ selectedTier, setSelectedTier }) => {
  const tiers = [
    { id: 1, name: 'Tier 1: Material List', icon: <FileText className="w-6 h-6" />, description: 'Generates a complete list of required materials and quantities.' },
    { id: 2, name: 'Tier 2: Full Method & Plan', icon: <Zap className="w-6 h-6" />, description: 'Includes Tier 1 plus a detailed, step-by-step construction guide.' },
    { id: 3, name: 'Tier 3: Customer-Ready Quote', icon: <UserCheck className="w-6 h-6" />, description: 'Includes Tier 2 plus a professional quote with estimated labour costs.' },
  ];

  return (
    <Card>
      <h2 className="text-xl sm:text-2xl font-bold text-gray-800 mb-4">Select Your Service Tier</h2>
      <div className="space-y-4">
        {tiers.map(tier => (
          <div
            key={tier.id}
            onClick={() => setSelectedTier(tier.id)}
            className={`p-4 border rounded-lg cursor-pointer transition-all duration-200 ${selectedTier === tier.id ? 'border-blue-500 bg-blue-50 ring-2 ring-blue-500' : 'border-gray-300 hover:border-blue-400 hover:bg-gray-50'}`}
          >
            <div className="flex items-center gap-4">
              <div className={`p-2 rounded-full ${selectedTier === tier.id ? 'bg-blue-500 text-white' : 'bg-gray-200 text-gray-600'}`}>
                {tier.icon}
              </div>
              <div>
                <h3 className="font-semibold text-gray-800">{tier.name}</h3>
                <p className="text-sm text-gray-600">{tier.description}</p>
              </div>
            </div>
          </div>
        ))}
      </div>
    </Card>
  );
};

const QuoteOutput = ({ quote, tier, materialPrices, setMaterialPrices }) => {
  // Hooks are now called at the top level, unconditionally.
  const totalCost = useMemo(() => {
    if (!quote) return 0; // Guard clause inside the hook
    return quote.materials.reduce((acc, item) => {
      const price = parseFloat(materialPrices[item.id]) || 0;
      return acc + (price * item.quantity);
    }, 0);
  }, [quote, materialPrices]);

  const updatedCustomerQuote = useMemo(() => {
    if (!quote || !quote.customerQuote) return null; // Guard clause inside the hook
    const subTotal = totalCost + quote.customerQuote.labourCost;
    const vat = subTotal * 0.20;
    const total = subTotal + vat;
    return {
      ...quote.customerQuote,
      materialsCost: totalCost,
      vat,
      total
    };
  }, [quote, totalCost]);

  // The conditional return is now at the end, after all hooks have been called.
  if (!quote) {
    return null;
  }

  const { materials, method } = quote;

  const handlePriceChange = (id, price) => {
    setMaterialPrices(prevPrices => ({
      ...prevPrices,
      [id]: price
    }));
  };

  return (
    <Card className="mt-8">
      <h2 className="text-2xl sm:text-3xl font-bold text-gray-800 mb-6 border-b pb-4">Your Generated Plan</h2>

      {/* Tier 1: Materials List */}
      <div className="mb-8">
        <h3 className="text-xl font-semibold text-gray-700 mb-4">Tier 1: Material List</h3>
         <div className="p-3 bg-yellow-50 border border-yellow-200 rounded-lg mb-4 text-sm text-yellow-800 flex items-center gap-2">
            <Edit className="w-4 h-4" />
            Enter the prices you receive from your merchants below to calculate the total material cost.
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-left">
            <thead>
              <tr className="bg-gray-100 text-sm font-semibold text-gray-600">
                <th className="p-3">Product</th>
                <th className="p-3 text-center">Quantity</th>
                <th className="p-3">Unit Price (£)</th>
                <th className="p-3 text-right">Total Price (£)</th>
              </tr>
            </thead>
            <tbody>
              {materials.map(item => (
                <tr key={item.id} className="border-b">
                  <td className="p-3 font-medium text-gray-800">{item.name}</td>
                  <td className="p-3 text-center text-gray-600">{item.quantity.toFixed(2)} {item.unit}</td>
                  <td className="p-3">
                    <input
                      type="number"
                      placeholder="0.00"
                      className="w-24 p-1 border rounded-md text-right"
                      value={materialPrices[item.id] || ''}
                      onChange={(e) => handlePriceChange(item.id, e.target.value)}
                    />
                  </td>
                  <td className="p-3 text-right font-semibold text-gray-800">
                    {((materialPrices[item.id] || 0) * item.quantity).toFixed(2)}
                  </td>
                </tr>
              ))}
            </tbody>
            <tfoot>
              <tr className="font-bold text-lg">
                <td colSpan="3" className="p-3 text-right text-gray-800">Grand Total (Materials)</td>
                <td className="p-3 text-right text-blue-600">£{totalCost.toFixed(2)}</td>
              </tr>
            </tfoot>
          </table>
        </div>
      </div>

      {/* Tier 2: Method */}
      {tier >= 2 && method && (
        <div className="mb-8">
          <h3 className="text-xl font-semibold text-gray-700 mb-4">Tier 2: Construction Method</h3>
          <div className="prose prose-blue max-w-none">
            <ol>
              {method.steps.map((step, index) => (
                <li key={index}>{step}</li>
              ))}
            </ol>
            <div className="mt-4 p-4 bg-yellow-50 border border-yellow-200 rounded-lg">
              <h4 className="font-bold">Important Considerations:</h4>
              <ul className="list-disc pl-5">
                {method.considerations.map((item, index) => (
                  <li key={index}>{item}</li>
                ))}
              </ul>
            </div>
          </div>
        </div>
      )}

      {/* Tier 3: Customer Quote */}
      {tier >= 3 && updatedCustomerQuote && (
        <div>
          <h3 className="text-xl font-semibold text-gray-700 mb-4">Tier 3: Customer-Ready Quote</h3>
          <div className="border rounded-lg p-6 bg-gray-50">
            <h4 className="text-2xl font-bold text-center mb-2">Your Company Name</h4>
            <p className="text-center text-gray-500 mb-6">123 Trade Street, Buildtown, UK</p>

            <div className="flex justify-between mb-4">
                <div>
                    <p className="font-bold">Quote For:</p>
                    <p>[Client Name]</p>
                    <p>[Client Address]</p>
                </div>
                <div>
                    <p><strong>Quote #:</strong> {updatedCustomerQuote.quoteNumber}</p>
                    <p><strong>Date:</strong> {updatedCustomerQuote.date}</p>
                </div>
            </div>

            <p className="mb-4"><strong>Project:</strong> {updatedCustomerQuote.projectDescription}</p>

            <table className="w-full text-left mb-4">
              <thead>
                <tr className="bg-gray-200 text-sm font-semibold text-gray-600">
                  <th className="p-2">Description</th>
                  <th className="p-2 text-right">Cost</th>
                </tr>
              </thead>
              <tbody>
                <tr className="border-b">
                  <td className="p-2">Supply of all materials (cost based on your entry)</td>
                  <td className="p-2 text-right">£{updatedCustomerQuote.materialsCost.toFixed(2)}</td>
                </tr>
                <tr className="border-b">
                  <td className="p-2">Estimated Labour & Installation</td>
                  <td className="p-2 text-right">£{updatedCustomerQuote.labourCost.toFixed(2)}</td>
                </tr>
              </tbody>
            </table>

            <div className="text-right">
              <p className="text-gray-600">Subtotal: £{(updatedCustomerQuote.materialsCost + updatedCustomerQuote.labourCost).toFixed(2)}</p>
              <p className="text-gray-600">VAT (20%): £{updatedCustomerQuote.vat.toFixed(2)}</p>
              <p className="text-2xl font-bold text-gray-800 mt-2">Total: £{updatedCustomerQuote.total.toFixed(2)}</p>
            </div>
            <p className="text-xs text-gray-500 mt-6">This quote is valid for 30 days. Labour cost is an estimate. Material cost is based on prices entered by the user. Terms and conditions apply.</p>
          </div>
        </div>
      )}
    </Card>
  );
};


// --- Main App Component ---
export default function App() {
  const [jobDescription, setJobDescription] = useState('I want to build a patio which is on a grass area currently and it will be 5x4 metres in size and I want it out of natural stone.');
  const [selectedTier, setSelectedTier] = useState(1);
  const [quote, setQuote] = useState(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState(null);
  const [materialPrices, setMaterialPrices] = useState({});

  // This function now calls a backend API endpoint
  const generateQuote = async () => {
    setIsLoading(true);
    setError(null);
    setQuote(null);
    setMaterialPrices({});

    // The Vite development server automatically proxies requests starting with /api
    // to your backend functions, so we can use a relative path.
    const API_ENDPOINT = '/api/generate-quote';

    try {
      const response = await fetch(API_ENDPOINT, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          jobDescription: jobDescription,
          products: MOCK_PRODUCTS,
        }),
      });

      if (!response.ok) {
        // Try to get a more detailed error message from the backend
        const errorData = await response.json();
        throw new Error(errorData.error || `API call failed with status: ${response.status}`);
      }

      const parsedResponse = await response.json();

      // Now, we use the AI's response to build the quote object
      const areaMatch = jobDescription.toLowerCase().match(/(\d+)\s*x\s*(\d+)/);
      const area = areaMatch ? parseInt(areaMatch[1]) * parseInt(areaMatch[2]) : 20;
      const labourCost = area * 80; // Example labour cost

      const customerQuote = {
          quoteNumber: `Q-${Math.floor(1000 + Math.random() * 9000)}`,
          date: new Date().toLocaleDateString('en-GB'),
          projectDescription: `Construction of a ${area}m² patio area.`,
          materialsCost: 0,
          labourCost,
          vat: 0,
          total: 0,
      };

      setQuote({
          materials: parsedResponse.materials, // Use materials from AI
          method: parsedResponse.method, // Use method from AI
          customerQuote: customerQuote,
      });

    } catch (err) {
      console.error(err);
      setError(`Sorry, something went wrong. ${err.message}`);
    } finally {
      setIsLoading(false);
    }
  };

  const canGenerate = useMemo(() => jobDescription.trim().length > 10, [jobDescription]);

  return (
    <div className="bg-gray-100 min-h-screen font-sans">
      <div className="container mx-auto p-4 sm:p-6 lg:p-8">
        <header className="text-center mb-8">
          <h1 className="text-4xl sm:text-5xl font-extrabold text-gray-800">
            AI Material & Quote Generator
          </h1>
          <p className="text-lg text-gray-600 mt-2">
            Your intelligent assistant for construction project planning.
          </p>
        </header>

        <main className="max-w-4xl mx-auto">
          <div className="space-y-8">
            <JobInput jobDescription={jobDescription} setJobDescription={setJobDescription} />
            <TierSelector selectedTier={selectedTier} setSelectedTier={setSelectedTier} />

            <div className="text-center pt-4">
              <Button onClick={generateQuote} disabled={!canGenerate || isLoading}>
                {isLoading ? (
                  <>
                    <svg className="animate-spin -ml-1 mr-3 h-5 w-5 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                    </svg>
                    Generating...
                  </>
                ) : (
                  <>
                    <Zap className="w-5 h-5" />
                    Generate Plan
                  </>
                )}
              </Button>
              {!canGenerate && <p className="text-xs text-red-500 mt-2">Please enter a more detailed job description (at least 10 characters).</p>}
            </div>
          </div>
          {error && <div className="mt-8 p-4 bg-red-100 border border-red-300 text-red-800 rounded-lg">{error}</div>}
          {quote && <QuoteOutput quote={quote} tier={selectedTier} materialPrices={materialPrices} setMaterialPrices={setMaterialPrices} />}
        </main>

        <footer className="text-center mt-12 text-gray-500 text-sm">
          <p>&copy; {new Date().getFullYear()} At Trade Price Plugin. All rights reserved.</p>
        </footer>
      </div>
    </div>
  );
}