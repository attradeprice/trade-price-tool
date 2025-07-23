import { GoogleGenerativeAI } from '@google/generative-ai';
import * as cheerio from 'cheerio'; // Import cheerio

// Helper function to extract keywords from a job description
function extractKeywords(description) {
    const lowerDesc = description.toLowerCase();
    const stopWords = new Set(['a', 'an', 'the', 'in', 'on', 'for', 'with', 'i', 'want', 'to', 'build', 'and', 'is', 'it', 'will', 'be', 'area', 'size', 'using', 'out', 'of', 'i\'m', 'looking', 'need', 'needs', 'a', 'an', 'the', 'some', 'any', 'for', 'to', 'with', 'in', 'on', 'at', 'by', 'from', 'about', 'as', 'of', 'or', 'and', 'but', 'not', 'that', 'this', 'these', 'those', 'can', 'will', 'should', 'would', 'could', 'materials', 'product', 'products', 'items', 'stuff', 'my', 'job', 'project', 'plan', 'specifications']);
    
    // Improved regex to handle common contractions and ensure clean words
    const keywords = lowerDesc
        .replace(/[^\w\s']/g, '') // remove punctuation except apostrophes
        .split(/\s+/)
        .filter(word => !stopWords.has(word) && word.length > 2);
        
    return [...new Set(keywords)].join(' '); // Return unique keywords as a string
}

// Scraper function
async function scrapeProductData(query) {
    const searchUrl = `https://attradeprice.co.uk/?s=${encodeURIComponent(query)}&post_type=product`;
    console.log(`--- SCRAPER: Attempting to fetch URL: ${searchUrl} ---`);

    try {
        const response = await fetch(searchUrl);
        const html = await response.text();

        console.log(`--- SCRAPER: Raw HTML Received (first 1000 chars): ${html.substring(0, 1000)}... ---`);
        console.log(`--- SCRAPER: Full HTML length: ${html.length} ---`);

        const $ = cheerio.load(html);
        const products = [];

        // *** DEFINITIVE WOODMART SELECTORS ***
        // Target the main product wrapper specifically, which contains the title, link, and description.
        const productElements = $('.wd-product'); 

        if (productElements.length === 0) {
            console.log("--- SCRAPER: No '.wd-product' elements found. This means the main product containers were not identified. ---");
            // Also log a snippet of the body content if no products found, to ensure HTML is being loaded
            console.log(`--- SCRAPER: Body content snippet (no products found): ${$('body').html().substring(0, 500)}... ---`);
        }

        productElements.each((i, el) => {
            const $el = $(el);
            // Within .wd-product, find the title link (usually inside h3.wd-entities-title)
            const titleElement = $el.find('.wd-entities-title a');
            const title = titleElement.text().trim();
            const link = titleElement.attr('href');
            
            // Find the short description. Based on your HTML, it's often within '.hover-content-inner.wd-more-desc-inner'.
            let description = $el.find('.hover-content-inner.wd-more-desc-inner').text().trim();

            if (title && link) {
                products.push({ title, link, description });
            }
        });
        
        console.log(`--- SCRAPER: Products found by scraper: ${JSON.stringify(products)} ---`);
        return products;

    } catch (error) {
        console.error("--- SCRAPER ERROR: Failed to scrape product data:", error);
        return [];
    }
}


export default async function handler(req, res) {
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
    if (!apiKey) {
      throw new Error("API key not found.");
    }

    const genAI = new GoogleGenerativeAI(apiKey);
    
    // Extract keywords for a broad search initially, focusing on material types
    const keywords = extractKeywords(jobDescription);
    const primarySearchTerms = `${keywords} natural stone paving OR pointing compound OR mot type 1 OR sand OR cement OR weed membrane`; // Broad terms
    
    // Perform the scraping directly from the backend
    const scrapedProducts = await scrapeProductData(primarySearchTerms);

    // Prepare products for the AI
    const productCatalogForAI = scrapedProducts.map(p => ({
        title: p.title,
        description: p.description, // Include the scraped description
        link: p.link
    }));

    console.log(`--- AI INPUT: Product catalog for AI: ${JSON.stringify(productCatalogForAI)} ---`);

    // The AI model with the search tool
    const model = genAI.getGenerativeModel({ 
        model: "gemini-1.5-flash",
        tools: [{ "Google Search_retrieval": {} }] 
    });

    const prompt = `
      You are an expert quantity surveyor for a UK-based building materials supplier called "At Trade Price".
      Your task is to analyze a customer's job description and suggest materials from the PROVIDED product catalog.

      **Customer Job Description:**
      "${jobDescription}"

      **Product Catalog from AtTradePrice.co.uk (ONLY use products from this list if relevant, otherwise mark as 'to be quoted'):**
      ${JSON.stringify(productCatalogForAI)}

      **Instructions & Rules:**
      1.  Analyze the 'Customer Job Description' to determine all necessary materials and their quantities. Assume a 10% waste factor for materials like paving, aggregates, and membranes.
      2.  For each material needed, try to find a direct match or highly relevant product from the 'Product Catalog'.
      3.  **Crucially:** If you find multiple suitable products for a single material requirement from the 'Product Catalog' (e.g., "Kandla Grey Natural Stone Paving" and "Brazilian Slate Paving" for a "Natural Stone Paving" need), you MUST include them as an array of 'options'. Each option must have an 'id' (which is the exact 'title' from the catalog) and a 'name' (which is the exact 'title' from the catalog). Do NOT invent product names. Use the exact titles from the provided catalog.
      4.  If a material is needed for the job (e.g., "MOT Type 1 Sub-base", "Cement", "Sand") but you **cannot** find any specific, relevant product for it in the 'Product Catalog', you MUST still include it in the material list as a single item (not with options). For these items, set the 'id' to a generic, descriptive string like "generic-mot1" or "generic-cement", and set the 'name' to describe the material followed by "(to be quoted)".
      5.  Quantities should be sensible (e.g., "m²" for paving, "m³" for aggregates, "bags" or "tubs" for cement/pointing compound).
      6.  Generate a JSON object with the following exact structure. Note the 'options' field which should be an array of matching products (using their exact 'title' for both 'id' and 'name') if multiple products are found, otherwise it should be null.
          {
            "materials": [
              { 
                "id": "<unique_id_for_material_group_or_product_title>", 
                "name": "<Generic Material Name like 'Natural Stone Paving' OR exact Product Title>", 
                "quantity": <calculated_quantity>, 
                "unit": "<standard_unit>",
                "options": [
                    { "id": "<exact_product_title_1>", "name": "<exact_product_title_1>" },
                    { "id": "<exact_product_title_2>", "name": "<exact_product_title_2>" }
                ]
              },
              {
                "id": "generic-cement",
                "name": "Cement (to be quoted)",
                "quantity": 10,
                "unit": "bags",
                "options": null
              }
              // ... more materials
            ],
            "method": {
              "steps": ["<step_1>", "<step_2>", ...],
              "considerations": ["<consideration_1>", "<consideration_2>", ...]
            }
          }
      7.  Your entire response MUST be only the raw JSON object. Do not include any extra text, explanations, or markdown formatting. The response must start with { and end with }.
    `;

    const result = await model.generateContent(prompt);
    const response = await result.response;
    let aiResponseText = response.text();

    console.log(`--- AI RAW RESPONSE ---`);
    console.log(aiResponseText);
    console.log(`--- END AI RAW RESPONSE ---`);

    const jsonStart = aiResponseText.indexOf('{');
    const jsonEnd = aiResponseText.lastIndexOf('}');
    if (jsonStart === -1 || jsonEnd === -1) {
      throw new Error("AI did not return a valid JSON object. Raw response was: " + aiResponseText);
    }
    aiResponseText = aiResponseText.substring(jsonStart, jsonEnd + 1);

    const parsedJsonResponse = JSON.parse(aiResponseText);

    res.status(200).json(parsedJsonResponse);

  } catch (error) {
    console.error("Error in serverless function:", error);
    res.status(500).json({ error: "An internal server error occurred.", details: error.message });
  }
}