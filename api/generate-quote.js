import { GoogleGenerativeAI } from '@google/generative-ai';
import stringSimilarity from 'string-similarity';

// ——— Helpers —————————————————————————————————————————————

// Strip sizes, “pack of”, parentheses, etc.
const cleanTitle = (title = '') =>
  title
    .replace(
      /(pack of\s*\d+|\d+\s?(x|×)\s?\d+\s?(mm|cm|m)?|\d+(mm|cm|m|kg|ltr|sqm|m²)|bulk|single|each)/gi,
      ''
    )
    .replace(/\(.*?\)/g, '')   // remove anything in parentheses
    .replace(/[-–|•]+.*/g, '') // drop trailing text after dash/bullet
    .trim();

// Call your WP REST endpoint
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

// ——— AI routines ——————————————————————————————————————————

async function getProjectType(desc, genAI) {
  const model = genAI.getGenerativeModel({ model: 'gemini-1.5-flash' });
  const prompt = `Identify in a few words the primary trade or project type for: "${desc}".`;
  const result = await model.generateContent(prompt);
  return result.response.text().trim();
}

async function generateExpertPlan(desc, projectType, genAI) {
  const model = genAI.getGenerativeModel({ model: 'gemini-1.5-flash' });
  const prompt = `
You are an expert in ${projectType}.
Based on this project: "${desc}"
Return **only** a JSON object with:
{
  "materials": [ { "name":"string", "quantity":number, "unit":"string" } ],
  "method":   { "steps":[ "string" ], "considerations":[ "string" ] },
  "customerQuote": { "labourHours": number }
}
`;
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

    // 1) Identify project type
    const projectType = await getProjectType(jobDescription, genAI);

    // 2) Generate materials + plan
    const plan = await generateExpertPlan(jobDescription, projectType, genAI);

    // 3) Safely pull out arrays/objects
    const materialsList = Array.isArray(plan.materials) ? plan.materials : [];
    const method =
      plan.method && typeof plan.method === 'object'
        ? plan.method
        : { steps: [], considerations: [] };
    const cq =
      plan.customerQuote && typeof plan.customerQuote === 'object'
        ? plan.customerQuote
        : {};
    const labourHours = Number(cq.labourHours) || 0;
    const labourRate = Number(cq.labourRate) || 35;

    // 4) Build materials with ALL relevant products fuzzy-filtered
    const finalMaterials = [];

    for (const mat of materialsList) {
      const materialName = (mat.name || mat.item || '').trim();
      if (!materialName) continue;

      // a) Clean off sizes/packs
      const baseQuery = cleanTitle(materialName);

      // b) Primary search
      let products = await searchWordPressProducts(baseQuery);

      // c) If nothing, split on words (length>3) and union
      if (!products.length) {
        const words = baseQuery.split(/\s+/).filter(w => w.length > 3);
        const all = [];
        for (const w of words) {
          const p = await searchWordPressProducts(w);
          all.push(...p);
        }
        // dedupe by ID
        products = Array.from(new Map(all.map(p => [p.id, p])).values());
      }

      // d) Filter out “colour” dyes etc.
      products = products.filter(p => !/colour\b/i.test(p.name));

      // e) If STILL none -> manual fallback
      if (!products.length) {
        finalMaterials.push({
          ...mat,
          name: materialName,
          options: [
            {
              id: `manual-${baseQuery.replace(/\s+/g, '-')}`,
              name: materialName,
              image: null,
              description: '❌ Not found – please manually price this item.',
              link: null,
            },
          ],
        });
        continue;
      }

      // f) Fuzzy-score ALL returned products
      const cleanedMat = baseQuery.toLowerCase();
      const targets = products.map(p => cleanTitle(p.name).toLowerCase());
      const { ratings } = stringSimilarity.findBestMatch(cleanedMat, targets);

      const scored = ratings
        .map(r => ({
          score: r.rating,
          product: products.find(
            p => cleanTitle(p.name).toLowerCase() === r.target
          ),
        }))
        .filter(e => e.product)
        .sort((a, b) => b.score - a.score);

      // g) Filter out any with very low relevance (<0.3)
      const relevant = scored
        .filter(e => e.score >= 0.3)
        .map(e => e.product);

      // if none pass threshold, use them all
      const finalList = relevant.length ? relevant : scored.map(e => e.product);

      // h) Build dropdown options, always starting with the original material
      const placeholder = {
        id: `manual-${baseQuery.replace(/\s+/g, '-')}`,
        name: materialName,
        image: null,
        description: 'Select matching product…',
        link: null,
      };
      const options = [
        placeholder,
        ...finalList.map(p => ({
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

    // 5) Compose and return the quote
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
