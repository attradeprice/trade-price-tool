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
    patio: 'paving stone slab flags patio',
    fencing: 'fence panel post timber gravelboard',
    cement: 'cement mortar joint filler bonding',
    aggregate: 'sand gravel ballast mot subbase sub-base hardcore',
    wall: 'bricks blocks render pier footing coping',
  };

  const expanded = new Set(words);
  words.forEach((w) => {
    if (synonyms[w]) synonyms[w].split(' ').forEach((s) => expanded.add(s));
  });

  return Array.from(expanded).join(' ');
};

const cleanTitle = (title) =>
  title
    .replace(/\s?[\d.]+(m|mm|kg|m²|sqm|inch|")/gi, '')
    .replace(/(\s+-\s+.*|\(.*\))/, '')
    .trim();

const groupProducts = (results) => {
  const groups = {};
  results.forEach((p) => {
    const baseName = cleanTitle(p.name);
    if (!groups[baseName]) groups[baseName] = [];
    groups[baseName].push({
      id: p.id,
      name: p.name,
      image: p.image || null,
      description: p.description || '',
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

    const descriptions = Object.values(grouped)
      .flat()
      .map(p => `${p.name} - ${p.description}`)
      .join('\n');

    const prompt = `
You're a UK-based quantity surveyor and builder. Based on the user's project description, generate a full quote using only the provided material options.

PROJECT DESCRIPTION (rewrite professionally for the customer):
"${jobDescription}"

AVAILABLE MATERIAL OPTIONS (variants):
${descriptions}

Strictly respond with:
{
  materials: [
    {
      name: string,
      quantity: number,
      unit: string,
      options: [ { id, name, image, description } ]
    }
  ],
  method: {
    steps: [ string ],
    considerations: [ string ]
  },
  customerQuote: {
    rewrittenProjectSummary: string,
    labourHours: number,
    labourRate: number,
    labourCost: number
  }
}

Use detailed method steps matching UK Building Regulations. Describe each construction step clearly as if the reader is an apprentice. Labour rate = £35/hr.`;

    const genAI = new GoogleGenerativeAI(process.env.VITE_GOOGLE_API_KEY);
    const model = genAI.getGenerativeModel({ model: 'gemini-1.5-flash' });
    const result = await model.generateContent(prompt);
    const raw = result.response.text();
    const json = JSON.parse(raw.substring(raw.indexOf('{'), raw.lastIndexOf('}') + 1));

    // Attach dropdown options
    json.materials.forEach((item) => {
      const match = grouped[item.name];
      item.options = match && match.length ? match : [
        {
          id: `manual-${item.name}`,
          name: item.name,
          image: null,
          description: '',
        },
      ];
    });

    // Add quote number & calculated totals
    json.customerQuote.quoteNumber = `Q-${Date.now()}`;
    json.customerQuote.date = new Date().toLocaleDateString('en-GB');
    json.customerQuote.vat = 0;
    json.customerQuote.materialsCost = 0;
    json.customerQuote.total = json.customerQuote.labourCost;

    res.status(200).json(json);
  } catch (err) {
    console.error('Quote API error:', err);
    res.status(500).json({ error: 'AI generation failed', details: err.message });
  }
}
