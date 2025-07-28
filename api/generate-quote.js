// /api/generate-quote.js

import { GoogleGenerativeAI } from '@google/generative-ai';

const extractKeywords = (description) => {
  const stopWords = new Set([
    'a', 'an', 'the', 'in', 'on', 'for', 'with', 'i', 'want', 'to', 'build', 'and',
    'it', 'will', 'be', 'area', 'size', 'using', 'out', 'of', 'which', 'currently',
    'grass', 'metres', 'meter', 'long', 'high'
  ]);

  const words = description
    .toLowerCase()
    .replace(/[^\w\s]/g, '')
    .split(/\s+/)
    .filter(w => !stopWords.has(w) && w.length > 2);

  const synonyms = {
    paving: 'paving slabs stone flags',
    patio: 'patio paving area slabbed',
    stone: 'stone slate sandstone limestone',
    fence: 'fence fencing timber posts panels',
    decking: 'decking composite timber joists',
  };

  const expanded = new Set(words);
  words.forEach(w => {
    if (synonyms[w]) {
      synonyms[w].split(' ').forEach(s => expanded.add(s));
    }
  });

  return Array.from(expanded).join(' ');
};

const searchWordPressProducts = async (query) => {
  const url = `https://attradeprice.co.uk/wp-json/atp/v1/search-products?q=${encodeURIComponent(query)}`;
  const res = await fetch(url);
  if (!res.ok) throw new Error(`WordPress search failed`);
  return res.json();
};

export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).end('Method Not Allowed');

  try {
    const { jobDescription } = req.body;
    if (!jobDescription) return res.status(400).json({ error: 'Missing job description' });

    const keywords = extractKeywords(jobDescription);
    const searchResults = await searchWordPressProducts(keywords);

    const apiKey = process.env.VITE_GOOGLE_API_KEY;
    const genAI = new GoogleGenerativeAI(apiKey);
    const model = genAI.getGenerativeModel({ model: 'gemini-1.5-flash' });

    const prompt = `
You are a British Quantity Surveyor and Materials Specialist working for "At Trade Price".
Using the job description and product catalogue below, return a comprehensive JSON quote plan.

---
Customer Job Description:
"${jobDescription}"

Available Product Catalogue:
${JSON.stringify(searchResults.slice(0, 30), null, 2)}
---

Rules:
- Return every required material for the job. Do not omit standard items like sub-base, sand, mortar, fixings.
- If a material is not found in catalogue, add it manually with "(to be quoted)".
- For each material, match with multiple similar/variant products from the catalogue (by keywords). Do not repeat same product twice.
- Remove dimension/size suffixes (like "600x900") from titles in dropdowns — keep them clean.
- Also return a detailed method plan with numbered construction steps and practical UK site advice.

Format:
{
  "materials": [
    {
      "id": "material-key",
      "name": "Natural Stone Paving",
      "quantity": 24,
      "unit": "m²",
      "options": [
        {
          "id": "https://attradeprice.co.uk/product-url",
          "name": "Lakeland Indian Sandstone",
          "image": "https://..."
        },
        ...
      ]
    },
    ...
  ],
  "method": {
    "steps": ["Step 1...", "Step 2..."],
    "considerations": ["Site access...", "Drainage..."]
  }
}
Only return JSON. Do not include commentary.
    `;

    const result = await model.generateContent(prompt);
    const raw = result.response.text();
    const json = JSON.parse(raw.substring(raw.indexOf('{'), raw.lastIndexOf('}') + 1));

    res.status(200).json(json);
  } catch (err) {
    console.error('API Error:', err);
    res.status(500).json({ error: 'AI generation failed', details: err.message });
  }
}
