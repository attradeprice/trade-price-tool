import { GoogleGenerativeAI } from '@google/generative-ai';

// Helper function to extract keywords from a job description
function extractKeywords(description) {
    const lowerDesc = description.toLowerCase();
    const stopWords = new Set(['a', 'an', 'the', 'in', 'on', 'for', 'with', 'i', 'want', 'to', 'build', 'and', 'is', 'it', 'will', 'be', 'area', 'size', 'using', 'out', 'of', 'i\'m', 'looking', 'need', 'needs', 'a', 'an', 'the', 'some', 'any', 'for', 'to', 'with', 'in', 'on', 'at', 'by', 'from', 'about', 'as', 'of', 'or', 'and', 'but', 'not', 'that', 'this', 'these', 'those', 'can', 'will', 'should', 'would', 'could', 'materials', 'product', 'products', 'items', 'stuff', 'my', 'job', 'project', 'plan', 'specifications']);
    
    const keywords = lowerDesc
        .replace(/[^\w\s']/g, '') 
        .split(/\s+/)
        .filter(word => !stopWords.has(word) && word.length > 2);
        
    return [...new Set(keywords)].join(' ');
}

// Function to fetch product data directly from WordPress REST API
async function fetchProductsFromWordPressAPI(query) {
    // Your WordPress site's base URL and the custom endpoint
    const apiUrl = `https://attradeprice.co.uk/wp-json/atp/v1/search-products?q=${encodeURIComponent(query)}`;
    console.log(`--- WP API FETCH: Attempting to fetch URL: ${apiUrl} ---`);

    try {
        const response = await fetch(apiUrl);
        if (!response.ok) {
            const errorBody = await response.text();
            throw new Error(`WordPress API returned status ${response.status}: ${errorBody}`);
        }
        const products = await response.json();
        console.log(`--- WP API FETCH: Products received from WordPress API: ${JSON.stringify(products)} ---`);
        return products;
    } catch (error) {
        console.error("--- WP API FETCH ERROR: Failed to fetch products from WordPress API:", error);
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
    
    const keywords = extractKeywords(jobDescription);
    // Use broad, but targeted terms for the API search query to increase chances of finding relevant products.
    const searchTermsForAPI = `${keywords} natural stone paving OR pointing compound OR mot type 1 OR sand OR cement OR weed membrane OR patio OR gravel OR slate`; 
    
    // Call the WordPress API function
    const fetchedProducts = await fetchProductsFromWordPressAPI(searchTermsForAPI);

    // Prepare products for the AI - including full product objects
    const productCatalogForAI = fetchedProducts.map(p => ({
        id: p.id, // Pass the WordPress product ID
        title: p.title,
        description: p.description, 
        link: p.link,
        image: p.image 
    }));

    console.log(`--- AI INPUT: Product catalog for AI: ${JSON.stringify(productCatalogForAI)} ---`);

    // Removed the 'tools' property entirely - this should fix the AI error.
    const model = genAI.getGenerativeModel({ 
        model: "gemini-1.5-flash"
    });

    const prompt = `
      You are an expert quantity surveyor for a UK-based building materials supplier called "At Trade Price".
      Your task is to analyze a customer's job description and suggest materials *strictly* from the PROVIDED product catalog.

      **Customer Job Description:**
      "${jobDescription}"

      **Product Catalog from AtTradePrice.co.uk (You MUST ONLY use products from this list if relevant, otherwise mark as 'to be quoted'. Do NOT use your general knowledge to suggest other products not in this list. For options, use the exact 'title' for both 'id' and 'name'):**
      ${JSON.stringify(productCatalogForAI)}

      **Instructions & Rules:**
      1.  Analyze the 'Customer Job Description' to determine all necessary materials and their quantities. Assume a 10% waste factor for materials like paving, aggregates, and membranes.
      2.  For each material needed, try to find a direct match or highly relevant product from the 'Product Catalog'. Use the 'description' field from the catalog if available to better understand the product.
      3.  **Crucially:** If you find multiple suitable products for a single material requirement from the 'Product Catalog' (e.g., "Kandla Grey Natural Stone Paving" and "Brazilian Slate Paving" for a "Natural Stone Paving" need), you MUST include them as an array of 'options'. Each option MUST have an 'id' (which is the exact 'title' from the catalog) and a 'name' (which is the exact 'title' from the catalog). Do NOT invent product names. Use the exact titles from the provided catalog.
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