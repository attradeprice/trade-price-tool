// /api/generate-quote.js
import { GoogleGenerativeAI } from '@google/generative-ai';

const stopWords = new Set([
  'a', 'an', 'the', 'in', 'on', 'for', 'with', 'i', 'want', 'to', 'build', 'and', 'is',
  'it', 'will', 'be', 'area', 'size', 'using', 'out', 'of', 'which', 'currently',
  'grass', 'metres', 'meter', 'long', 'high', 'by', 'from'
]);

const extractKeywords = (text) => {
  const words = text
    .toLowerCase()
    .replace(/[^\w\s]/g, '')
    .split(/\s+/)
    .filter((w) => !stopWords.has(w) && w.length > 2);

  const synonyms = {
    patio: 'paving stone slab flags',
    fencing: 'fence panel post timber',
    cement: 'paving cement mortar joint filler',
    aggregate: 'sand gravel ballast mot subbase sub-base',
  };

  const expanded = new Set(words);
  words.forEach((w) => {
    if (synonyms[w]) synonyms[w].split(' ').forEach((s) => expanded.add(s));
  });

  return Array.from(expanded).join(' ');
};

const cleanTitle = (title) =>
  title
    .replace(/\s?[\d.]+(m|mm|kg|m²|sqm|inch|")/gi, '') // remove dimensions
    .replace(/(\s+-\s+.*|\(.*\))/, '') // remove brackets & suffixes
    .trim();

const groupProducts = (results) => {
  const groups = {};
  results.forEach((p) => {
    const baseName = cleanTitle(p.title.rendered || '');
    if (!groups[baseName]) groups[baseName] = [];
    groups[baseName].push({
      id: p.link,
      name: cleanTitle(p.title.rendered || ''),
      image: p.images?.[0] || null,
    });
  });
  return groups;
};

const searchWordPressProducts = async (query) => {
  const url = `https://attradeprice.co.uk/wp-json/atp/v1/search-products?q=${encodeURIComponent(query)}`;
  const res = await fetch(url);
  if (!res.ok) throw new Error('Product search failed');
  return res.json();
};

export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).end('Method Not Allowed');

  try {
    const { jobDescription } = req.body;
    if (!jobDescription) return res.status(400).json({ error: 'Missing job description' });

    const keywords = extractKeywords(jobDescription);
    const searchResults = await searchWordPressProducts(keywords);
    const grouped = groupProducts(searchResults);

    const prompt = `
You're an expert quantity surveyor. Based on the user's project description, use the product groups below to create a detailed construction material quote in JSON format.

User's Job Description:
"${jobDescription}"

Available Material Groups:
${JSON.stringify(Object.keys(grouped), null, 2)}

Rules:
- Pick materials needed to complete the project properly.
- Group variants (like different types of paving) together under one item.
- Add generic items (e.g. MOT Type 1 Sub-base, cement, sand, fixings) even if not found in search.
- Use only these fields:
  - id: unique string
  - name: material group name
  - quantity: estimated number
  - unit: m², m, each, etc.
  - options: dropdown options for user, based on the group

- Output also a "method" object with "steps" and "considerations".
- No explanation or extra text.

Respond with only:
{
  materials: [...],
  method: {
    steps: [...],
    considerations: [...]
  }
}
`;

    const genAI = new GoogleGenerativeAI(process.env.VITE_GOOGLE_API_KEY);
    const model = genAI.getGenerativeModel({ model: 'gemini-1.5-flash' });
    const result = await model.generateContent(prompt);
    const raw = result.response.text();

    const json = JSON.parse(raw.substring(raw.indexOf('{'), raw.lastIndexOf('}') + 1));

    // Add dropdown options with fallback
    json.materials.forEach((item) => {
      const match = grouped[item.name] || [];
      item.options = match.length
        ? match
        : [
            {
              id: `manual-${item.name}`,
              name: item.name,
              image: null,
            },
          ];
    });

    res.status(200).json(json);
  } catch (err) {
    console.error('Quote API error:', err);
    res.status(500).json({ error: 'AI generation failed', details: err.message });
  }
}
