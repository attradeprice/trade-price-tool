import React, { useState, useMemo, useEffect } from 'react';
import { Zap, FileText, UserCheck, Edit, Upload, Building, User, ShoppingCart, ChevronDown } from 'lucide-react';

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
        : 'bg-brand hover:bg-brand-hover shadow-md hover:shadow-lg transform hover:-translate-y-0.5'
    } ${className}`}
  >
    {children}
  </button>
);

const Input = ({ label, value, onChange, placeholder, name }) => (
    <div>
        <label htmlFor={name} className="block text-sm font-medium text-gray-700">{label}</label>
        <input
            type="text"
            name={name}
            id={name}
            value={value}
            onChange={onChange}
            placeholder={placeholder}
            className="mt-1 block w-full px-3 py-2 bg-white border border-gray-300 rounded-md shadow-sm placeholder-gray-400 focus:outline-none focus:ring-brand focus:border-brand sm:text-sm"
        />
    </div>
);

// --- Product Dropdown Component ---
function ProductDropdown({ options, value, onChange }) {
  const [open, setOpen] = useState(false);
  const selected = options.find(opt => opt.name === value) || options[0];

  return (
    <div className="relative">
      <button
        type="button"
        onClick={() => setOpen(!open)}
        className="w-full p-2 border rounded flex items-center justify-between bg-white text-left"
      >
        <div className="flex items-center">
            {selected.image && (
              <img
                src={selected.image}
                alt={selected.name}
                className="w-8 h-8 mr-2 object-cover rounded"
              />
            )}
            <span>{selected.name}</span>
        </div>
        <ChevronDown size={20} className={`transition-transform ${open ? 'rotate-180' : ''}`} />
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
                  className="w-8 h-8 mr-2 object-cover rounded"
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


// --- Core Components ---

const JobInput = ({ jobDescription, setJobDescription }) => (
  <Card>
    <h2 className="text-xl sm:text-2xl font-bold text-gray-800 mb-4">1. Describe Your Project</h2>
    <p className="text-gray-600 mb-4">
      Provide as much detail as possible. For example: "I want to build a patio on a grass area, 5x4 metres, using natural stone."
    </p>
    <textarea
      value={jobDescription}
      onChange={(e) => setJobDescription(e.target.value)}
      className="w-full h-40 p-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-brand focus:border-brand transition-shadow duration-200"
      placeholder="Enter job description here..."
    />
  </Card>
);

const QuoteDetailsForm = ({ companyDetails, setCompanyDetails, customerDetails, setCustomerDetails, vatRate, setVatRate, logo, setLogo }) => {
    const handleCompanyChange = (e) => {
        setCompanyDetails({ ...companyDetails, [e.target.name]: e.target.value });
    };

    const handleCustomerChange = (e) => {
        setCustomerDetails({ ...customerDetails, [e.target.name]: e.target.value });
    };

    const handleLogoChange = (e) => {
        if (e.target.files && e.target.files[0]) {
            const logoUrl = URL.createObjectURL(e.target.files[0]);
            setLogo(logoUrl);
        }
    };

    return (
        <Card>
            <h2 className="text-xl sm:text-2xl font-bold text-gray-800 mb-6">2. Customize Your Quote (Tier 3 Only)</h2>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                {/* Your Company Details */}
                <div className="space-y-4">
                    <h3 className="text-lg font-semibold text-gray-700 flex items-center gap-2"><Building size={20} /> Your Details</h3>
                    <Input label="Your Company Name" name="name" value={companyDetails.name} onChange={handleCompanyChange} placeholder="e.g., Your Trade Co." />
                    <Input label="Your Address" name="address" value={companyDetails.address} onChange={handleCompanyChange} placeholder="e.g., 123 Main Street, London" />
                    <div>
                        <label className="block text-sm font-medium text-gray-700">Your Logo</label>
                        <div className="mt-1 flex items-center gap-4">
                            <span className="inline-block h-12 w-12 rounded-full overflow-hidden bg-gray-100">
                                {logo ? <img src={logo} alt="Company Logo" className="h-full w-full object-cover" /> : <Upload className="h-full w-full text-gray-300 p-3" />}
                            </span>
                            <input type="file" onChange={handleLogoChange} accept="image/*" className="text-sm text-gray-500 file:mr-4 file:py-2 file:px-4 file:rounded-full file:border-0 file:text-sm file:font-semibold file:bg-brand/10 file:text-brand hover:file:bg-brand/20"/>
                        </div>
                        <p className="text-xs text-gray-500 mt-1">Logo is for this session only and will not be saved.</p>
                    </div>
                </div>

                {/* Customer Details */}
                <div className="space-y-4">
                    <h3 className="text-lg font-semibold text-gray-700 flex items-center gap-2"><User size={20} /> Customer's Details</h3>
                    <Input label="Customer Name" name="name" value={customerDetails.name} onChange={handleCustomerChange} placeholder="e.g., John Doe" />
                    <Input label="Customer Address" name="address" value={customerDetails.address} onChange={handleCustomerChange} placeholder="e.g., 456 Client Avenue, Bristol" />
                     <div>
                        <label htmlFor="vatRate" className="block text-sm font-medium text-gray-700">VAT Rate (%)</label>
                        <input
                            type="number"
                            name="vatRate"
                            id="vatRate"
                            value={vatRate}
                            onChange={(e) => setVatRate(e.target.value)}
                            className="mt-1 block w-full px-3 py-2 bg-white border border-gray-300 rounded-md shadow-sm placeholder-gray-400 focus:outline-none focus:ring-brand focus:border-brand sm:text-sm"
                        />
                    </div>
                </div>
            </div>
        </Card>
    );
};


const TierSelector = ({ selectedTier, setSelectedTier }) => {
  const tiers = [
    { id: 1, name: 'Tier 1: Material List', icon: <FileText className="w-6 h-6" />, description: 'Generates a complete list of required materials and quantities.' },
    { id: 2, name: 'Tier 2: Full Method & Plan', icon: <Zap className="w-6 h-6" />, description: 'Includes Tier 1 plus a detailed, step-by-step construction guide.' },
    { id: 3, name: 'Tier 3: Customer-Ready Quote', icon: <UserCheck className="w-6 h-6" />, description: 'Includes Tier 2 plus a professional quote with estimated labour costs.' },
  ];

  return (
    <Card>
      <h2 className="text-xl sm:text-2xl font-bold text-gray-800 mb-4">3. Select Your Service Tier</h2>
      <div className="space-y-4">
        {tiers.map(tier => (
          <div
            key={tier.id}
            onClick={() => setSelectedTier(tier.id)}
            className={`p-4 border rounded-lg cursor-pointer transition-all duration-200 ${selectedTier === tier.id ? 'border-brand bg-teal-50 ring-2 ring-brand' : 'border-gray-300 hover:border-brand/50 hover:bg-gray-50'}`}
          >
            <div className="flex items-center gap-4">
              <div className={`p-2 rounded-full ${selectedTier === tier.id ? 'bg-brand text-white' : 'bg-gray-200 text-gray-600'}`}>
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

const QuoteOutput = ({ quote, tier, materialPrices, setMaterialPrices, companyDetails, customerDetails, vatRate, logo, userSelections, setUserSelections }) => {
  const totalCost = useMemo(() => {
    if (!quote) return 0;
    return quote.materials.reduce((acc, item) => {
      // For items with options, we don't include them in the manual price calculation
      if (item.options && item.options.length > 0) return acc;
      const price = parseFloat(materialPrices[item.id]) || 0;
      return acc + (price * item.quantity);
    }, 0);
  }, [quote, materialPrices]);

  const updatedCustomerQuote = useMemo(() => {
    if (!quote || !quote.customerQuote) return null;
    const subTotal = totalCost + quote.customerQuote.labourCost;
    const vat = subTotal * (parseFloat(vatRate) / 100);
    const total = subTotal + vat;
    return {
      ...quote.customerQuote,
      materialsCost: totalCost,
      vat,
      total
    };
  }, [quote, totalCost, vatRate]);

  const handleAddToCart = () => {
    const cartBaseUrl = 'https://attradeprice.co.uk/quote-cart/';
    const cartItems = quote.materials.map((item, index) => {
        let selectedName = item.name;
        // If the item has options, use the user's selection for the name
        if (item.options && item.options.length > 0) {
            selectedName = userSelections[item.id] || item.options[0].name;
        }
        const encodedName = encodeURIComponent(selectedName);
        return `item_${index+1}_name=${encodedName}&item_${index+1}_qty=${Math.ceil(item.quantity)}`;
    });
    const cartUrl = `${cartBaseUrl}?${cartItems.join('&')}`;
    window.open(cartUrl, '_blank');
  };

  const handleSelectionChange = (itemId, selectedName) => {
      setUserSelections(prev => ({...prev, [itemId]: selectedName}));
  };

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
      <div className="flex justify-between items-center mb-6 border-b pb-4">
        <h2 className="text-2xl sm:text-3xl font-bold text-gray-800">Your Generated Plan</h2>
        <button
            onClick={handleAddToCart}
            className="flex items-center gap-2 rounded-lg px-4 py-2 text-sm font-semibold text-white bg-green-600 hover:bg-green-700 shadow-md hover:shadow-lg transition-all duration-300"
        >
            <ShoppingCart size={18} />
            Add to Quote Cart
        </button>
      </div>
      <div className="mb-8">
        <h3 className="text-xl font-semibold text-gray-700 mb-4">Tier 1: Material List</h3>
         <div className="p-3 bg-blue-50 border border-blue-200 rounded-lg mb-4 text-sm text-blue-800 flex items-center gap-2">
            <ChevronDown className="w-4 h-4" />
            For items with multiple options, use the dropdown to make your selection.
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
                  <td className="p-3 font-medium text-gray-800">
                    {item.options && item.options.length > 0 ? (
                        <div className="flex flex-col gap-1">
                            <span className="font-bold">{item.name}</span>
                            <ProductDropdown
                                options={item.options}
                                value={userSelections[item.id] || item.options[0].name}
                                onChange={(selectedValue) => handleSelectionChange(item.id, selectedValue)}
                            />
                        </div>
                    ) : (
                        item.name
                    )}
                  </td>
                  <td className="p-3 text-center text-gray-600">{item.quantity.toFixed(2)} {item.unit}</td>
                  <td className="p-3">
                    <input
                      type="number"
                      placeholder="0.00"
                      className="w-24 p-1 border rounded-md text-right"
                      // Disable price input for items with options, as price is determined by selection
                      disabled={item.options && item.options.length > 0}
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
                <td className="p-3 text-right text-brand">£{totalCost.toFixed(2)}</td>
              </tr>
            </tfoot>
          </table>
        </div>
      </div>
      {tier >= 2 && method && (
        <div className="mb-8">
          <h3 className="text-xl font-semibold text-gray-700 mb-4">Tier 2: Construction Method</h3>
          <div className="prose prose-teal max-w-none">
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
      {tier >= 3 && updatedCustomerQuote && (
        <div>
          <h3 className="text-xl font-semibold text-gray-700 mb-4">Tier 3: Customer-Ready Quote</h3>
          <div className="border rounded-lg p-6 bg-gray-50">
             <img src={logo || "https://attradeprice.co.uk/wp-content/uploads/2023/04/logo-dark.png"} alt="Company Logo" className="h-16 mx-auto mb-4" />
            <h4 className="text-2xl font-bold text-center mb-2">{companyDetails.name || "Your Company Name"}</h4>
            <p className="text-center text-gray-500 mb-6">{companyDetails.address || "123 Trade Street, Buildtown, UK"}</p>
            <div className="flex justify-between mb-4">
                <div>
                    <p className="font-bold">Quote For:</p>
                    <p>{customerDetails.name || "[Client Name]"}</p>
                    <p>{customerDetails.address || "[Client Address]"}</p>
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
              <p className="text-gray-600">VAT ({vatRate}%): £{updatedCustomerQuote.vat.toFixed(2)}</p>
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
  const [companyDetails, setCompanyDetails] = useState({ name: '', address: '' });
  const [customerDetails, setCustomerDetails] = useState({ name: '', address: '' });
  const [vatRate, setVatRate] = useState(20);
  const [logo, setLogo] = useState(null);
  const [userSelections, setUserSelections] = useState({});

  const generateQuote = async () => {
    setIsLoading(true);
    setError(null);
    setQuote(null);
    setMaterialPrices({});
    setUserSelections({});

    const API_ENDPOINT = '/api/generate-quote';

    try {
      const response = await fetch(API_ENDPOINT, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          jobDescription: jobDescription,
        }),
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.details || errorData.error || `API call failed with status: ${response.status}`);
      }

      const parsedResponse = await response.json();

      const areaMatch = jobDescription.toLowerCase().match(/(\d+)\s*x\s*(\d+)/);
      const area = areaMatch ? parseInt(areaMatch[1]) * parseInt(areaMatch[2]) : 20;
      const labourCost = area * 80;

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
          materials: parsedResponse.materials,
          method: parsedResponse.method,
          customerQuote: customerQuote,
      });

    } catch (err) {
      console.error(err);
      setError(`Sorry, something went wrong. Details: ${err.message}`);
    } finally {
      setIsLoading(false);
    }
  };

  const canGenerate = useMemo(() => jobDescription.trim().length > 10, [jobDescription]);

  return (
    <div className="bg-gray-100 min-h-screen font-sans">
      <div className="container mx-auto p-4 sm:p-6 lg:p-8">
        <header className="text-center mb-8">
          <img src="https://attradeprice.co.uk/wp-content/uploads/2023/04/logo-dark.png" alt="At Trade Price Logo" className="h-16 mx-auto mb-4" />
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
            
            {selectedTier === 3 && (
                <QuoteDetailsForm 
                    companyDetails={companyDetails}
                    setCompanyDetails={setCompanyDetails}
                    customerDetails={customerDetails}
                    setCustomerDetails={setCustomerDetails}
                    vatRate={vatRate}
                    setVatRate={setVatRate}
                    logo={logo}
                    setLogo={setLogo}
                />
            )}
            
            <TierSelector selectedTier={selectedTier} setSelectedTier={setSelectedTier} />

            <div className="text-center pt-4">
              <Button onClick={generateQuote} disabled={!canGenerate || isLoading}>
                {isLoading ? (
                  <>
                    <svg className="animate-spin -ml-1 mr-3 h-5 w-5 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0-0 24 24">
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
          {quote && <QuoteOutput quote={quote} tier={selectedTier} materialPrices={materialPrices} setMaterialPrices={setMaterialPrices} companyDetails={companyDetails} customerDetails={customerDetails} vatRate={vatRate} logo={logo} userSelections={userSelections} setUserSelections={setUserSelections} />}
        </main>

        <footer className="text-center mt-12 text-gray-500 text-sm">
          <p>&copy; {new Date().getFullYear()} At Trade Price. All rights reserved.</p>
        </footer>
      </div>
    </div>
  );
}
