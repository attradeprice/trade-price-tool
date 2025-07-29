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

    const savedCompany = localStorage.getItem('companyDetails');
    const savedCustomer = localStorage.getItem('customerDetails');
    const savedVat = localStorage.getItem('vatRate');

    if (savedCompany) setCompanyDetails(JSON.parse(savedCompany));
    if (savedCustomer) setCustomerDetails(JSON.parse(savedCustomer));
    if (savedVat) setVatRate(Number(savedVat));

    const qParam = new URLSearchParams(window.location.search).get('quote');
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

  useEffect(() => {
    localStorage.setItem('companyDetails', JSON.stringify(companyDetails));
  }, [companyDetails]);

  useEffect(() => {
    localStorage.setItem('customerDetails', JSON.stringify(customerDetails));
  }, [customerDetails]);

  useEffect(() => {
    localStorage.setItem('vatRate', vatRate);
  }, [vatRate]);

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
        quoteNumber: `Q-${Date.now()}`,
        date: new Date().toLocaleDateString('en-GB'),
        projectDescription: jobDescription,
        projectSummary: result.method?.summary || '',
        labourHours: 0,
        hourlyRate: 25,
        vatRate: vatRate / 100,
        company: companyDetails,
        customer: customerDetails,
        logo: logo || null,
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
    if (!selected) return;
    const updatedQuote = {
      ...quote,
      selectedMaterials: {
        ...(quote.selectedMaterials || {}),
        [materialId]: selected,
      },
    };
    setQuote(updatedQuote);
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

        <QuoteOutput
          quote={quote}
          setQuote={setQuote}
          selectedTier={selectedTier}
          onAddToCart={handleAddToCart}
        />
      </div>
    </div>
  );
}
