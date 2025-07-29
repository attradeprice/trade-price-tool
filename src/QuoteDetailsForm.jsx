// src/QuoteDetailsForm.jsx
import React, { useEffect, useState } from 'react';

export default function QuoteDetailsForm({
  companyDetails,
  setCompanyDetails,
  customerDetails,
  setCustomerDetails,
  vatRate,
  setVatRate,
  logo,
  setLogo,
}) {
  const [errors, setErrors] = useState({});

  useEffect(() => {
    const savedCompany = localStorage.getItem('companyDetails');
    const savedCustomer = localStorage.getItem('customerDetails');
    const savedVat = localStorage.getItem('vatRate');

    if (savedCompany) setCompanyDetails(JSON.parse(savedCompany));
    if (savedCustomer) setCustomerDetails(JSON.parse(savedCustomer));
    if (savedVat) setVatRate(Number(savedVat));
  }, []);

  useEffect(() => {
    localStorage.setItem('companyDetails', JSON.stringify(companyDetails));
  }, [companyDetails]);

  useEffect(() => {
    localStorage.setItem('customerDetails', JSON.stringify(customerDetails));
  }, [customerDetails]);

  useEffect(() => {
    localStorage.setItem('vatRate', vatRate);
  }, [vatRate]);

  const validate = (name, value) => {
    if (!value.trim()) {
      setErrors((prev) => ({ ...prev, [name]: 'Required field' }));
    } else {
      setErrors((prev) => {
        const updated = { ...prev };
        delete updated[name];
        return updated;
      });
    }
  };

  const handleChange = (e, setter, obj) => {
    const { name, value } = e.target;
    setter({ ...obj, [name]: value });
    validate(name, value);
  };

  const handleLogoChange = (e) => {
    if (e.target.files?.[0]) {
      const logoUrl = URL.createObjectURL(e.target.files[0]);
      setLogo(logoUrl);
    }
  };

  return (
    <div className="bg-white p-6 rounded-lg shadow-md space-y-6">
      <div>
        <h2 className="text-lg font-bold text-gray-800 mb-4">Your Company Details</h2>
        <input
          type="text"
          name="name"
          value={companyDetails.name}
          onChange={(e) => handleChange(e, setCompanyDetails, companyDetails)}
          placeholder="Company Name"
          className="w-full mb-1 p-2 border rounded"
        />
        {errors.name && <p className="text-xs text-red-600 mb-1">{errors.name}</p>}

        <input
          type="text"
          name="address"
          value={companyDetails.address}
          onChange={(e) => handleChange(e, setCompanyDetails, companyDetails)}
          placeholder="Company Address"
          className="w-full mb-1 p-2 border rounded"
        />
        {errors.address && <p className="text-xs text-red-600 mb-1">{errors.address}</p>}

        <input
          type="file"
          accept="image/*"
          onChange={handleLogoChange}
          className="block w-full text-sm text-gray-500"
        />
        {logo && <img src={logo} alt="Company Logo" className="h-12 mt-2" />}
      </div>

      <div>
        <h2 className="text-lg font-bold text-gray-800 mb-4">Customer Details</h2>
        <input
          type="text"
          name="name"
          value={customerDetails.name}
          onChange={(e) => handleChange(e, setCustomerDetails, customerDetails)}
          placeholder="Customer Name"
          className="w-full mb-1 p-2 border rounded"
        />
        {errors.name && <p className="text-xs text-red-600 mb-1">{errors.name}</p>}

        <input
          type="text"
          name="address"
          value={customerDetails.address}
          onChange={(e) => handleChange(e, setCustomerDetails, customerDetails)}
          placeholder="Customer Address"
          className="w-full mb-1 p-2 border rounded"
        />
        {errors.address && <p className="text-xs text-red-600 mb-1">{errors.address}</p>}

        <input
          type="number"
          value={vatRate}
          onChange={(e) => setVatRate(Number(e.target.value))}
          placeholder="VAT Rate (%)"
          min="0"
          max="100"
          className="w-full mb-1 p-2 border rounded"
        />
      </div>
    </div>
  );
}
