import { GoogleGenerativeAI } from '@google/generative-ai';
import React, { useState } from 'react';

// Stopwords to ignore when extracting keywords.
const stopWords = new Set([
  'a', 'an', 'the', 'in', 'on', 'for', 'with', 'i', 'want', 'to', 'build', 'and', 'is',
  'it', 'will', 'be', 'area', 'size', 'using', 'out', 'of', 'which', 'currently',
  'grass', 'metres', 'meter', 'long', 'high'
]);

// Fallback synonyms used only if the AI fails to extract any keywords.
const fallbackSynonyms = {
  paving: ['paving', 'slabs'],
  stone: ['stone', 'sandstone', 'limestone', 'slate', 'granite', 'travertine', 'quartzite', 'basalt', 'yorkstone', 'porphyry'],
  patio: ['patio', 'paving'],
  aggregate: ['aggregate', 'sand', 'cement', 'mot'],
  brick: ['brick', 'block', 'red brick'],
  block: ['block', 'concrete block'],
  mortar: ['mortar', 'jointing', 'joint', 'jointing compound', 'pointing compound', 'slurry', 'primer', 'adhesive', 'bonding', 'bonding agent'],
  cement: ['cement', 'postcrete'],
  adhesive: ['adhesive', 'primer', 'slurry primer', 'sbr', 'pva', 'bonding agent', 'tile adhesive']
};

async function getSearchKeywords(description, model) {
  const extractionPrompt = `
    Identify all distinct material, product, consumable or accessory keywords
    that could be relevant when searching a building materials catalogue for
    the following project description. Include not only primary materials
    (e.g. "stone", "cement") but also ancillary items such as primers, bonding
    slurry, jointing compound, fixings, adhesives, pipes, taps, etc. Only
    list nouns and material types (no measurements, no verbs, no job steps).
    Return them as a comma-separated list without any additional text.

    Job description: "${description}"
  `;
  try {
    const result = await model.generateContent(extractionPrompt);
    const text = result.response.text().trim();
    let keywords = text.split(/[;,]/).map(k => k.trim().toLowerCase()).filter(Boolean);
    keywords = keywords.filter(w => !stopWords.has(w) && !/^\d+(x\d+)?$/.test(w));
    return Array.from(new Set(keywords));
  } catch (err) {
    console.error('Keyword extraction failed:', err.message);
    return [];
  }
}

function fallbackKeywordExtractor(description) {
  const words = description.toLowerCase().replace(/[^\w\s]/g, '').split(/\s+/);
  const keywords = new Set();
  for (const w of words) {
    if (w && !stopWords.has(w) && !/^\d+(x\d+)?$/.test(w) && w.length > 2) {
      keywords.add(w);
      if (fallbackSynonyms[w]) {
        fallbackSynonyms[w].forEach(syn => keywords.add(syn));
      }
    }
  }
  return Array.from(keywords);
}

async function searchWordPressProducts(keywords) {
  // Combine all keywords into a single search query string.
  const searchQuery = keywords.join(' ');
  if (!searchQuery) {
    return [];
  }

  const url = `https://attradeprice.co.uk/wp-json/atp/v1/search-products?q=${encodeURIComponent(searchQuery)}`;
  console.log(`--- WP API FETCH: Attempting to fetch URL: ${url} ---`);

  try {
    const response = await fetch(url);
    if (!response.ok) {
      console.error(`Failed to fetch from WP API (${searchQuery}): ${response.statusText}`);
      // Return empty array on failure so the process can continue.
      return [];
    }
    const products = await response.json();
    return products;
  } catch (error) {
    console.error(`Error fetching keywords '${searchQuery}':`, error.message);
    return [];
  }
}

function filterByNaturalStonePreference(products, jobDescription) {
  const prefersNatural = /natural\s+stone/i.test(jobDescription);
  if (!prefersNatural) return products;
  const naturalStoneTerms = ['sandstone', 'limestone', 'slate', 'granite', 'travertine', 'yorkstone', 'porphyry', 'stone'];
  return products.filter(p => {
    const text = (p.name + ' ' + p.description).toLowerCase();
    const isNatural = naturalStoneTerms.some(term => text.includes(term));
    const isConcrete = /concrete|utility|pressed/.test(text);
    return isNatural && !isConcrete;
  });
}

export default async function handler(req, res) {
  console.log("--- EXECUTING CODE VERSION: JULY 27 @ 6:05 PM ---");
  
console.log("RAW AI RESPONSE:\n", aiText);

  if (req.method !== 'POST') {
    res.setHeader('Allow', ['POST']);
    return res.status(405).end(`Method ${req.method} Not Allowed`);
  }

  try {
    const { jobDescription } = req.body;
    if (!jobDescription) {
      return res.status(400).json({ error: 'Missing jobDescription in request body' });
    }

    const apiKey = process.env.VITE_GOOGLE_API_KEY;
    if (!apiKey) throw new Error("API key not found.");
    const genAI = new GoogleGenerativeAI(apiKey);
    const model = genAI.getGenerativeModel({ model: "gemini-1.5-flash" });

    let keywords = await getSearchKeywords(jobDescription, model);
    if (!keywords || keywords.length === 0) {
      keywords = fallbackKeywordExtractor(jobDescription);
    }

    let searchResults = await searchWordPressProducts(keywords);
    searchResults = filterByNaturalStonePreference(searchResults, jobDescription);

    console.log(`--- AI INPUT: Product catalog for AI:`, searchResults);

    const prompt = `
      You are an expert quantity surveyor for a UK-based building materials supplier called "At Trade Price".
      Your task is to analyze a customer's job description and a provided list of relevant products fetched directly from the attradeprice.co.uk website's product catalog.

      **Customer Job Description:**
      "${jobDescription}"

      **Product Catalog from attradeprice.co.uk (JSON format):**
      ${JSON.stringify(searchResults, null, 2)}

      **Instructions & Rules:**
      1. Analyze the provided "Product Catalog" list. The 'id' field is the product's unique URL and the 'name' field is the product title.
      2. Based on the job description, calculate the required quantity for each necessary material.
      3. Include ancillary materials such as primers, membranes, fixings, PPE, etc. If a suitable product is not in the catalog list for an ancillary item, mark its quantity as "(to be quoted)".
      4. When creating the 'options' array for a material, strip any size, color, or pack information from the product 'name' to create a generic option name (e.g., "Kandla Grey Sandstone Paving" becomes "Sandstone Paving").
      5. For multiple product matches for a single material type (e.g., several types of sandstone), group them and return them as an array of product options in the 'options' field. Each option object must have an 'id' (the product URL) and a 'name' (the full product name from the catalog).
      6. Include a detailed construction method with excavation, sub-base, bedding, priming, laying, jointing, drainage, and curing steps.
      7. Return the JSON object with this exact format:
         {
           "materials": [...],
           "method": {
             "steps": [...],
             "considerations": [...]
           }
         }
    8. Respond ONLY with a valid JSON object matching the format above. Do not include any commentary, explanations, or markdown — just return the raw JSON data.

    `;

    const result = await model.generateContent(prompt);
    const aiText = result.response.text();
    let jsonText;
try {
  jsonText = aiText.match(/\{[\s\S]*\}/)?.[0]; // matches the first JSON block
  if (!jsonText) throw new Error("No JSON found in AI response.");
  const parsed = JSON.parse(jsonText);
  return res.status(200).json(parsed);
} catch (err) {
  console.error("Failed to parse AI JSON:", err.message, "\nAI Response:", aiText);
  return res.status(500).json({ error: "Failed to parse AI response as valid JSON.", rawResponse: aiText });
}
    return res.status(200).json(parsed);

  } catch (error) {
    console.error("Error in serverless function:", error);
    return res.status(500).json({ error: "An internal server error occurred.", details: error.message });
  }
}
