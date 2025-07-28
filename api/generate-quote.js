// /api/generate-quote.js
import { GoogleGenerativeAI } from '@google/generative-ai';

const STOPWORDS = new Set([
  'a', 'an', 'the', 'in', 'on', 'for', 'with', 'i', 'want', 'to', 'build',
  'and', 'is', 'it', 'will', 'be', 'area', 'size', 'using', 'out', 'of',
  'which', 'currently', 'grass', 'metres', 'meter', 'long', 'high', 'style', 'type'
]);

const extractKeywords = (text) => {
  const words = text
    .toLowerCase()
    .replace(/[^\w\s]/g, '')
    .split(/\s+/)
    .filter(w => !STOPWORDS.has(w) && w.length > 2);

  return [...new Set(words)];
};

const cleanTitle = (name) =>
  name.replace(/\s?(\d+mm|\d+m|\d+x\d+mm|\d+cm|-\d+mm)?\s?/gi, '').trim();

const groupProducts = (products) => {
  const grouped = {};
  for (const p of products) {
    const name = cleanTitle(p.name);
    if (!grouped[name]) grouped[name] = [];
    grouped[name].push({
      id: p.url,
      name: p.name,
      image: p.image || '',
    });
  }
  return Object.entries(grouped).map(([name, options], index) => ({
    id: `mat_${index + 1}`,
    name,
    quantity: 1,
    unit: 'each',
    options,
  }));
};

const searchProducts = async (keywords) => {
  const query = keywords.join(' ');
  const res = await fetch(`https://attradeprice.co.uk/wp-json/atp/v1/search-products?q=${encodeURIComponent(query)}`);
  if (!res.ok) throw new Error('Search failed');
  const data = await res.json();
  return data.map(p => ({
    name: p.name,
    url: p.url,
    image: p.image,
  }));
};

export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).end();

  try {
    const { jobDescription } = req.body;
    if (!jobDescription) return res.status(400).json({ error: 'Missing description' });

    const keywords = extractKeywords(jobDescription);
    const products = await searchProducts(keywords);
    const groupedMaterials = groupProducts(products);

    const apiKey = process.env.VITE_GOOGLE_API_KEY;
    const genAI = new GoogleGenerativeAI(apiKey);
    const model = genAI.getGenerativeModel({ model: 'gemini-1.5-flash' });

    const prompt = `
You are an AI quantity surveyor generating a quote for:

Description: ${jobDescription}

Materials:
${JSON.stringify(groupedMaterials, null, 2)}

Instructions:
- Confirm quantities based on the description (assume m² for paving, panels for fencing, etc.).
- Retain grouped product options with images and links.
- If a key material is not found, still include it as "(to be quoted)".
- Add a construction method in numbered steps and 2-4 important considerations.

Respond with valid JSON only.

Format:
{
  "materials": [...],
  "method": {
    "steps": [...],
    "considerations": [...]
  }
}
    `.trim();

    const result = await model.generateContent(prompt);
    const raw = result.response.text();
    const json = JSON.parse(raw.substring(raw.indexOf('{'), raw.lastIndexOf('}') + 1));

    res.status(200).json(json);
  } catch (err) {
    console.error('AI Quote Error:', err);
    res.status(500).json({ error: 'Failed to generate quote', details: err.message });
  }
}
