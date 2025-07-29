import { GoogleGenerativeAI } from '@google/generative-ai';

const stopWords = new Set([
  'a', 'an', 'the', 'in', 'on', 'for', 'with', 'i', 'want', 'to', 'build', 'and', 'is',
  'it', 'will', 'be', 'area', 'size', 'using', 'out', 'of', 'which', 'currently',
  'grass', 'metres', 'meter', 'long', 'high', 'by', 'from'
]);

const synonyms = {
  patio: 'paving stone slab flags patio',
  fencing: 'fence panel post timber gravelboard',
  cement: 'cement mortar joint filler bonding',
  aggregate: 'sand gravel ballast mot subbase sub-base hardcore',
  wall: 'bricks blocks render pier footing coping',
};

const extractKeywords = (text) => {
  const words = text
    .toLowerCase()
    .replace(/[^\w\s]/g, '')
    .split(/\s+/)
    .filter((w) => !stopWords.has(w) && w.length > 2);

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
    const baseName = cleanTitle(p.name || p.title?.rendered || '');
    if (!groups[baseName]) groups[baseName] = [];
    groups[baseName].push({
      id: p.id || p.link,
      name: p.name || cleanTitle(p.title?.rendered || ''),
      image: p.image || p.images?.[0] || null,
      description: p.description || '',
    });
  });
  return groups;
};

const getClosestMatch = (targetName, grouped) => {
  let bestMatch = null;
  let highestScore = 0;

  const normalize = (str) => str.toLowerCase().replace(/[^\w\s]/g, '').trim();
  const wordsA = new Set(normalize(targetName).split(/\s+/));

  for (const [key, products] of Object.entries(grouped)) {
    const wordsB = new Set(normalize(key).split(/\s+/));
    const intersection = [...wordsA].filter(word => wordsB.has(word));
    const score = intersection.length / Math.max(wordsA.size, wordsB.size);

    if (score > highestScore && score > 0.3) {  // Adjust threshold here if needed
      bestMatch = products;
      highestScore = score;
    }
  }

  return bestMatch;
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
You are an expert British quantity surveyor. Based on the job description, use the material catalogue to produce a construction quote in JSON format. Always include common items like paving, MOT Type 1, sharp sand, edging, and joint filler when building patios.

Respond strictly in this format:
{
  materials: [
    {
      id: string,
      name: string,
      quantity: number,
      unit: string,
      options: [
        { id: string, name: string, image: string, description: string }
      ]
    }
  ],
  method: {
    steps: [ string ],
    considerations: [ string ]
  }
}

User Job Description:
"${jobDescription}"

Available Materials:
${descriptions}
`;

    const genAI = new GoogleGenerativeAI(process.env.VITE_GOOGLE_API_KEY);
    const model = genAI.getGenerativeModel({ model: 'gemini-1.5-flash' });
    const result = await model.generateContent(prompt);
    const raw = result.response.text();

    if (!raw.includes('{') || !raw.includes('materials')) {
      throw new Error('Gemini returned an incomplete or malformed response.');
    }

    const json = JSON.parse(raw.substring(raw.indexOf('{'), raw.lastIndexOf('}') + 1));

    function getBestMatchByWords(name, grouped) {
  const clean = str => str.toLowerCase().replace(/[^\w\s]/g, '').trim();
  const keywords = new Set(clean(name).split(/\s+/));

  let bestKey = null;
  let bestScore = 0;

  for (const [key, products] of Object.entries(grouped)) {
    const keyWords = new Set(clean(key).split(/\s+/));
    const matchCount = [...keywords].filter(word => keyWords.has(word)).length;
    const score = matchCount / keywords.size;

    if (score > bestScore && score >= 0.4) {
      bestKey = key;
      bestScore = score;
    }
  }

  return bestKey ? grouped[bestKey] : null;
}

json.materials.forEach((item) => {
  const match = getBestMatchByWords(item.name, grouped);
  item.options = match && match.length ? match : Object.values(grouped)[0] || [];
});

    res.status(200).json(json);
  } catch (err) {
    console.error('Quote API error:', err);
    res.status(500).json({ error: 'AI generation failed', details: err.message });
  }
}
