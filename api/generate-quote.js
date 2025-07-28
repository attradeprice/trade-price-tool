// /api/generate-quote.js
import { GoogleGenerativeAI } from '@google/generative-ai';

function extractKeywords(description) {
  const stopWords = new Set([
    'a', 'an', 'the', 'in', 'on', 'for', 'with', 'i', 'want', 'to', 'build', 'and', 'is',
    'it', 'will', 'be', 'area', 'size', 'using', 'out', 'of', 'which', 'currently',
    'grass', 'metres', 'meter', 'long', 'high'
  ]);

  const words = description
    .toLowerCase()
    .replace(/[^\w\s]/g, '')
    .split(/\s+/)
    .filter(w => !stopWords.has(w) && w.length > 2);

  const synonyms = {
    paving: 'paving slabs',
    stone: 'stone slate sandstone limestone',
    patio: 'patio paving',
    aggregate: 'aggregate sand cement mot',
  };

  const expanded = new Set(words);
  words.forEach(w => {
    if (synonyms[w]) {
      synonyms[w].split(' ').forEach(s => expanded.add(s));
    }
  });

  return Array.from(expanded).join(' ');
}

async function searchWordPressProducts(query) {
  const url = `https://attradeprice.co.uk/wp-json/atp/v1/search-products?q=${encodeURIComponent(query)}`;
  const res = await fetch(url);
  if (!res.ok) throw new Error(`WordPress search failed`);
  return res.json();
}

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
You are an expert quantity surveyor for "At Trade Price", a UK-based building supplier.
Based on this job description and these product options, generate a JSON quote plan.

Customer Description:
"${jobDescription}"

Product Catalog:
${JSON.stringify(searchResults, null, 2)}

Rules:
- Use products only from the catalog above.
- Group similar products under one material name with options.
- Exclude items with "concrete", "utility", "pressed" if user asked for "natural stone".
- Include unknown materials like "MOT Type 1" with note "(to be quoted)" if not found.
- Output a raw JSON object only.

Format:
{
  "materials": [
    {
      "id": "unique_material_id",
      "name": "e.g. Natural Stone Paving",
      "quantity": 12,
      "unit": "m²",
      "options": [
        {
          "id": "https://attradeprice.co.uk/product-a",
          "name": "Exact Product Name A",
          "image": "https://..."
        }
      ]
    }
  ],
  "method": {
    "steps": ["..."],
    "considerations": ["..."]
  }
}
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
