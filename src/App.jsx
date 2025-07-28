// src/App.jsx
import React, { useState, useEffect } from 'react';
import JobInput from './JobInput';
import QuoteDetailsForm from './QuoteDetailsForm';
import TierSelector from './TierSelector';
import GenerateButton from './GenerateButton';
import QuoteOutput from './QuoteOutput';

export default function App() {
  const [jobDescription, setJobDescription] = useState('');
  const [selectedTier, setSelectedTier] = useState(1);
  const [quote, setQuote] = useState(null);
  const [isLoading, setIsLoading] = useState(false);
  const [companyDetails, setCompanyDetails] = useState({ name: '', address: '' });
  const [customerDetails, setCustomerDetails] = useState({ name: '', address: '' });
  const [vatRate, setVatRate] = useState(20);
  const [logo, setLogo] = useState(null);

  useEffect(() => {
    const saved = localStorage.getItem('atp_last_quote');
    if (saved) setQuote(JSON.parse(saved));

    const urlParams = new URLSearchParams(window.location.search);
    const qParam = urlParams.get('quote');
    if (qParam && localStorage.getItem(`quote_${qParam}`)) {
      setQuote(JSON.parse(localStorage.getItem(`quote_${qParam}`)));
    }
  }, []);

  useEffect(() => {
    if (quote) {
      localStorage.setItem('atp_last_quote', JSON.stringify(quote));
      if (quote.customerQuote?.quoteNumber) {
        localStorage.setItem(`quote_${quote.customerQuote.quoteNumber}`, JSON.stringify(quote));
      }
    }
  }, [quote]);

  const handleGenerateQuote = async () => {
    setIsLoading(true);
    setQuote(null);
    try {
      const response = await fetch('/api/generate-quote', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ jobDescription }),
      });

      const result = await response.json();

      const customerQuote = {
        quoteNumber: `Q-${new Date().toISOString().slice(0,19).replace(/[-:T]/g,'')}`,
        date: new Date().toLocaleDateString('en-GB'),
        projectDescription: jobDescription,
        materialsCost: 0,
        labourCost: 0,
        vat: 0,
        total: 0,
      };

      setQuote({ ...result, customerQuote });
    } catch (error) {
      alert('Failed to generate quote.');
      console.error(error);
    } finally {
      setIsLoading(false);
    }
  };

  const handleAddToCart = (materialId, selected) => {
    console.log(`Selected material ${materialId}: ${selected}`);
  };

  return (
    <div className="min-h-screen bg-gray-100 p-6 font-sans">
      <div className="max-w-4xl mx-auto space-y-6">
        <header className="text-center">
          <img
            src="https://attradeprice.co.uk/wp-content/uploads/2023/04/logo-dark.png"
            alt="At Trade Price"
            className="h-16 mx-auto mb-4"
          />
          <h1 className="text-4xl font-bold text-gray-800">AI Material & Quote Generator</h1>
          <p className="text-sm text-gray-500">Built to British Building Standards</p>
        </header>

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

        <GenerateButton loading={isLoading} onClick={handleGenerateQuote} />

        <QuoteOutput quote={quote} onAddToCart={handleAddToCart} />
      </div>
    </div>
  );
}
