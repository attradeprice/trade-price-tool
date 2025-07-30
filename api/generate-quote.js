// /api/generate-quote.js

import { GoogleGenerativeAI } from '@google/generative-ai';
import stringSimilarity from 'string-similarity';

// ——— Helpers ———————————————————————————————————————————————

// Strip out sizes (“pack of…”, dimensions, units), parentheses, trailing bullets/dashes
const cleanTitle = (title = '') =>
  title
    .replace(
      /(pack of\s*\d+|\d+\s?(x|×)\s?\d+\s?(mm|cm|m)?|\d+(mm|cm|m|kg|ltr|sqm|m²)|bulk|single|each)/gi,
      ''
    )
    .replace(/\(.*?\)/g, '')    // remove parentheses
    .replace(/[-–|•]+.*/g, '')   // drop trailing bullet/ dash text
    .trim();

// Call your WP product‑search endpoint
async function searchWordPressProducts(query) {
  const url = `https://attradeprice.co.uk/wp-json/atp/v1/search-products?q=${encodeURIComponent(
    query
  )}`;
  try {
    const res = await fetch(url);
    if (!res.ok) {
      console.error('WP search failed:', res.status, await res.text());
      return [];
    }
    return await res.json();
  } catch (err) {
    console.error('Error fetching WP API:', err);
    return [];
  }
}

// Use Gemini to pick out which products match this material/tool request
async function classifyProducts(materialName, products, genAI) {
  if (!products.length) return [];
  if (products.length <= 3) return products.map(p => String(p.id));

  const model = genAI.getGenerativeModel({ model: 'gemini-1.5-flash' });
  const listText = products
    .map(p => `${p.id}: ${p.name} — ${p.description.replace(/\n/g, ' ')}`)
    .join('\n');

  const prompt = `
You are a product-matching assistant. The user needs exactly: "${materialName}".
Here are candidate products (ID: Name — Description):
${listText}

Select **only** those IDs whose name or technical description clearly matches that request.
Do NOT pick unrelated items. Respond with a JSON array of IDs, e.g. ["93242","93246"], and nothing else.
  `.trim();

  try {
    const result = await model.generateContent(prompt);
    const text = result.response.text().trim();
    const json = text.substring(text.indexOf('['), text.lastIndexOf(']') + 1);
    const arr = JSON.parse(json);
    if (Array.isArray(arr)) return arr.map(String);
  } catch (e) {
    console.error('Classification parse failed:', e);
  }
  return [];
}

// ——— AI: Determine project type & plan —————————————————————————

async function getProjectType(desc, genAI) {
  const model = genAI.getGenerativeModel({ model: 'gemini-1.5-flash' });
  const prompt = `In a few words, identify the primary trade or construction task for: "${desc}".`;
  const result = await model.generateContent(prompt);
  return result.response.text().trim();
}

async function generateExpertPlan(desc, projectType, genAI) {
  const model = genAI.getGenerativeModel({ model: 'gemini-1.5-flash' });
  const prompt = `
You are an expert in ${projectType}.
Based on this project: "${desc}",
output **only** a JSON object:

{
  "materials": [ { "name":"string", "quantity":number, "unit":"string" } ],
  "method":   { "steps":[ "string" ], "considerations":[ "string" ] },
  "customerQuote": { "labourHours": number, "labourRate": number }
}
  `.trim();

  const result = await model.generateContent(prompt);
  const raw = result.response.text();
  const json = raw.substring(raw.indexOf('{'), raw.lastIndexOf('}') + 1);
  return JSON.parse(json);
}

// ——— Main handler ——————————————————————————————————————————

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method Not Allowed' });
  }

  try {
    const { jobDescription } = req.body;
    if (!jobDescription) {
      return res.status(400).json({ error: 'Missing job description' });
    }

    const genAI = new GoogleGenerativeAI(process.env.VITE_GOOGLE_API_KEY);

    // 1) Determine project type
    const projectType = await getProjectType(jobDescription, genAI);

    // 2) Generate plan
    const plan = await generateExpertPlan(jobDescription, projectType, genAI);

    // 3) Safely extract
    const materialsList = Array.isArray(plan.materials) ? plan.materials : [];
    const method = plan.method || { steps: [], considerations: [] };
    const cq = plan.customerQuote || {};
    const labourHours = Number(cq.labourHours) || 0;
    const labourRate = Number(cq.labourRate) || 35;

    // 4) Build finalMaterials
    const finalMaterials = [];

    for (const mat of materialsList) {
      const materialName = (mat.name || mat.item || '').trim();
      if (!materialName) continue;

      // a) Clean query
      const baseQuery = cleanTitle(materialName);

      // b) Fetch candidates
      let products = await searchWordPressProducts(baseQuery);

      // c) If none, try word-by-word union
      if (!products.length) {
        const words = baseQuery.split(/\s+/).filter(w => w.length > 3);
        const all = [];
        for (const w of words) {
          all.push(...(await searchWordPressProducts(w)));
        }
        products = Array.from(new Map(all.map(p => [p.id, p])).values());
      }

      // d) Drop pure “colour” variants only
      products = products.filter(p => !/colour\b/i.test(p.name));

      // e) Fuzzy-match first
      const cleanMatLC = baseQuery.toLowerCase();
      const targets = products.map(p => cleanTitle(p.name).toLowerCase());
      const { ratings } = stringSimilarity.findBestMatch(cleanMatLC, targets);
      const scored = ratings
        .map(r => {
          const prod = products.find(
            p => cleanTitle(p.name).toLowerCase() === r.target
          );
          return prod ? { score: r.rating, product: prod } : null;
        })
        .filter(Boolean)
        .sort((a, b) => b.score - a.score);

      // filter to ensure every key query word appears in the product name
      const queryWords = baseQuery
        .toLowerCase()
        .split(/\s+/)
        .filter(w => w.length > 3);
      const filtered = scored.filter(({ product }) => {
        const name = cleanTitle(product.name).toLowerCase();
        return queryWords.every(w => name.includes(w));
      });

      // pick only high-confidence matches
      const THRESHOLD = 0.6;
      let chosen = filtered.filter(e => e.score >= THRESHOLD).map(e => e.product);

      // if ambiguous (none or multiple), use AI classifier to disambiguate
      if (chosen.length !== 1) {
        const keepIds = await classifyProducts(materialName, products, genAI);
        if (keepIds.length) {
          chosen = products.filter(p => keepIds.includes(String(p.id)));
        } else {
          // fallback: top 3 fuzzy from filtered set
          chosen = filtered.slice(0, 3).map(e => e.product);
        }
      }

      // g) Build options list (with manual placeholder first)
      const placeholder = {
        id: `manual-${baseQuery.replace(/\s+/g, '-')}`,
        name: materialName,
        image: null,
        description: 'Select matching product…',
        link: null,
      };
      const options = [
        placeholder,
        ...chosen.map(p => ({
          id: p.id,
          name: cleanTitle(p.name),
          image: p.image,
          description: p.description,
          link: `https://attradeprice.co.uk/?p=${p.id}`,
        })),
      ];

      finalMaterials.push({
        ...mat,
        name: materialName,
        options,
      });
    }

    // 5) Return assembled quote
    const quote = {
      materials: finalMaterials,
      method,
      customerQuote: {
        ...cq,
        quoteNumber: `Q-${Date.now()}`,
        date: new Date().toLocaleDateString('en-GB'),
        labourHours,
        labourRate,
        labourCost: labourHours * labourRate,
      },
    };

    return res.status(200).json(quote);
  } catch (err) {
    console.error('Error in /api/generate-quote:', err);
    return res
      .status(500)
      .json({ error: 'Failed to generate quote', details: err.message });
  }
}
