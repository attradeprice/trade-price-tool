// src/ProductDropdown.jsx
import React, { useEffect, useState } from 'react';
import Select from 'react-select';

const ProductDropdown = ({ selectedProduct, onSelect }) => {
  const [productOptions, setProductOptions] = useState([]);

  useEffect(() => {
    const fetchProducts = async () => {
      try {
        const res = await fetch('https://attradeprice.co.uk/wp-json/atp/v1/search-products');
        const data = await res.json();
        const options = data.map((product) => ({
          value: product.name,
          label: (
            <div style={{ display: 'flex', alignItems: 'center' }}>
              <img
                src={product.image}
                alt={product.name}
                style={{ width: 30, height: 30, marginRight: 10, objectFit: 'cover' }}
              />
              <span>{product.name}</span>
            </div>
          ),
          raw: product,
        }));
        setProductOptions(options);
      } catch (err) {
        console.error('Failed to fetch products:', err);
      }
    };

    fetchProducts();
  }, []);

  return (
    <div className="my-2">
      <label className="block text-sm font-medium text-gray-700">Select Product:</label>
      <Select
        options={productOptions}
        onChange={(selected) => onSelect(selected?.raw)}
        placeholder="Choose a product..."
        isSearchable
      />
    </div>
  );
};

export default ProductDropdown;
