/**
 * backend_service.js — Unified backend logic for Netto Panino Maker.
 *
 * Consolidates: api_test.js + most_promo_food_store.js + columns_salling_group.js
 *
 * Exports modular functions for the React Native app to import.
 * Can also be run standalone with `node backend_service.js` for testing.
 */

const { GoogleGenerativeAI } = require("@google/generative-ai");

// ─── Config ──────────────────────────────────────────────────────────────────
const GEMINI_API_KEY = process.env.EXPO_PUBLIC_GEMINI_API_KEY || "";
const SALLING_TOKEN = process.env.EXPO_PUBLIC_SALLING_TOKEN || "";
const ZIP = "2800";
const TARGET_STREETS = ["Engelsborgvej", "Jernbanepladsen"];
const API_URL = `https://api.sallinggroup.com/v1/food-waste?zip=${ZIP}`;

// ─── Gemini Models (instantiated once) ───────────────────────────────────────
const genAI = new GoogleGenerativeAI(GEMINI_API_KEY);
const premiumModel = genAI.getGenerativeModel({ model: "gemini-2.5-flash" });
const liteModel = genAI.getGenerativeModel({
  model: "gemini-2.5-flash-lite",
});

// ─── Helpers ─────────────────────────────────────────────────────────────────

/**
 * Calculate the current Netto week key.
 * Netto weeks run Saturday→Friday, so we use ISO week + year as the key.
 * Returns e.g. "2026_12"
 */
function getNettoWeek(date = new Date()) {
  // Adjust to the Saturday start: if today is Sat or later, this week; otherwise last week's Saturday
  const d = new Date(date);
  const day = d.getDay(); // 0=Sun, 6=Sat
  // Shift to Saturday-based week start
  const saturdayOffset = day >= 6 ? 0 : -(day + 1);
  d.setDate(d.getDate() + saturdayOffset);

  // ISO week number
  const janFirst = new Date(d.getFullYear(), 0, 1);
  const dayOfYear = Math.ceil((d - janFirst) / 86400000) + 1;
  const weekNum = Math.ceil(dayOfYear / 7);
  return `${d.getFullYear()}_${String(weekNum).padStart(2, "0")}`;
}

/**
 * Clean Gemini response: strip markdown fences and whitespace.
 */
function cleanJSON(text) {
  return text
    .replace(/```json/gi, "")
    .replace(/```/g, "")
    .trim();
}

// ─── Core Pipeline Functions ─────────────────────────────────────────────────

/**
 * STEP 1 — Fetch store data from Salling Group Food Waste API.
 * Returns only the two target stores (Engelsborgvej & Jernbanepladsen).
 */
async function fetchStoreData() {
  const response = await fetch(API_URL, {
    headers: { Authorization: `Bearer ${SALLING_TOKEN}` },
  });

  if (!response.ok) {
    throw new Error(`Salling API Error: ${response.status}`);
  }

  const allStores = await response.json();

  // Filter to target stores only
  const targetStores = allStores.filter((store) => {
    const street = store?.store?.address?.street || "";
    return TARGET_STREETS.some((t) => street.includes(t));
  });

  return targetStores;
}

/**
 * STEP 2 — Select the store with the most unique products in promotion.
 * Deterministic logic (replaces the old AI Scout agent).
 *
 * @param {Array} storesData - Filtered store array from fetchStoreData()
 * @returns {{ store: object, name: string, uniqueCount: number, clearances: Array }}
 */
function selectBestStore(storesData) {
  if (!storesData || storesData.length === 0) {
    return null;
  }

  const results = storesData.map((store) => {
    const street = store?.store?.address?.street || "Unknown";
    const clearances = store?.clearances || [];

    // Count unique products by EAN, fallback to description
    const uniqueProducts = new Set();
    for (const item of clearances) {
      const ean = item?.product?.ean;
      const description = item?.product?.description;
      if (ean) {
        uniqueProducts.add(`ean:${ean}`);
      } else if (description) {
        uniqueProducts.add(`desc:${description.trim().toLowerCase()}`);
      }
    }

    // Extract the short store name from the street
    const name = TARGET_STREETS.find((t) => street.includes(t)) || street;

    return {
      store,
      name,
      uniqueCount: uniqueProducts.size,
      clearances,
    };
  });

  // Sort descending by unique product count
  results.sort((a, b) => b.uniqueCount - a.uniqueCount);

  return results[0]; // Winner
}

/**
 * STEP 3 — AI Ingredient Filter.
 * Uses Gemini Lite to identify which clearance items are suitable for a sandwich.
 *
 * @param {Array} clearances - Raw clearance items from the winning store
 * @returns {Array} - Filtered list of item descriptions suitable for a panino
 */
async function filterPaninoIngredients(clearances) {
  // Build a numbered list of all products for the AI
  const itemList = clearances
    .map((item, i) => {
      const desc = item?.product?.description || "Unknown";
      const cat = item?.product?.categories?.en || item?.product?.categories?.da || "";
      return `${i + 1}. ${desc} (${cat})`;
    })
    .join("\n");

  const prompt = `
You are a sandwich ingredient expert. Below is a numbered list of discounted grocery items from a Danish supermarket.

${itemList}

Identify which items could be used as **sandwich (panino) ingredients**: bread, cheese, deli meats, spreads, vegetables, condiments, etc.

Exclude items that do NOT belong in a sandwich: ready meals, desserts, drinks, pet food, cleaning products, candy, frozen dinners, etc.

Respond ONLY in valid JSON format:
{ "suitable_indices": [1, 3, 5, ...] }

Where the numbers are the item indices from the list above.
  `;

  const result = await liteModel.generateContent(prompt);
  const parsed = JSON.parse(cleanJSON(result.response.text()));
  const indices = parsed.suitable_indices || [];

  // Map indices back to clearance items (1-based → 0-based)
  return indices
    .map((i) => clearances[i - 1])
    .filter(Boolean);
}

/**
 * STEP 4 — Standardize ingredient data.
 * Extracts and cleans only the required columns from raw clearance items.
 *
 * @param {Array} items - Raw clearance items (already filtered as panino-suitable)
 * @returns {Array<PaninoIngredient>}
 */
function standardizeIngredients(items) {
  return items.map((item) => ({
    ean: item?.product?.ean || `no-ean-${Date.now()}-${Math.random()}`,
    productName: item?.product?.description || "Unknown Product",
    productNameEn: null, // Populated by translateIngredients()
    productImage: item?.product?.image || null,
    categoryEn: item?.product?.categories?.en || item?.product?.categories?.da || "Uncategorized",
    newPrice: item?.offer?.newPrice ?? 0,
    originalPrice: item?.offer?.originalPrice ?? 0,
    discount: item?.offer?.discount ?? 0,
    percentDiscount: item?.offer?.percentDiscount ?? 0,
    stock: item?.offer?.stock ?? 0,
  }));
}

/**
 * STEP 4b — Translate Danish product names to English.
 * Uses Gemini Lite to batch-translate all ingredient names in one call.
 * Populates the `productNameEn` field on each ingredient.
 *
 * @param {Array} ingredients - Standardized ingredient list
 * @returns {Array} - Same list with `productNameEn` filled in
 */
async function translateIngredients(ingredients) {
  const danishNames = ingredients.map((item) => item.productName);

  const prompt = `
You are a translator for a Danish grocery app. Translate each Danish product name below into natural, appetizing English.
Keep it short (max 4–5 words per name). Do NOT add descriptions — just the translated product name.

Danish names:
${danishNames.map((n, i) => `${i + 1}. ${n}`).join("\n")}

Respond ONLY in valid JSON:
{ "translations": ["English Name 1", "English Name 2", ...] }

The array MUST have exactly ${danishNames.length} entries, one per input name, in the same order.
  `;

  try {
    const result = await liteModel.generateContent(prompt);
    const parsed = JSON.parse(cleanJSON(result.response.text()));
    const translations = parsed.translations || [];

    return ingredients.map((item, i) => ({
      ...item,
      productNameEn: translations[i] || item.productName, // Fallback to Danish if translation missing
    }));
  } catch (err) {
    console.warn("⚠️ Translation failed, falling back to Danish names:", err.message);
    return ingredients.map((item) => ({
      ...item,
      productNameEn: item.productName, // Graceful fallback
    }));
  }
}

/**
 * STEP 5 — Refresh stock for cached ingredients.
 * Re-fetches the API and updates only the `stock` field for each cached ingredient (by EAN).
 *
 * @param {Array} cachedIngredients - Previously cached ingredient list
 * @param {string} storeName - The name of the selected store
 * @returns {Array} - Updated ingredient list with fresh stock values
 */
async function refreshStock(cachedIngredients, storeName) {
  const storesData = await fetchStoreData();
  const store = storesData.find((s) => {
    const street = s?.store?.address?.street || "";
    return street.includes(storeName);
  });

  if (!store) return cachedIngredients; // Store not found, keep old stock

  const liveStockMap = new Map();
  for (const item of store.clearances || []) {
    const ean = item?.product?.ean;
    if (ean) {
      liveStockMap.set(ean, item?.offer?.stock ?? 0);
    }
  }

  // Merge fresh stock into the cached list
  return cachedIngredients.map((ingredient) => ({
    ...ingredient,
    stock: liveStockMap.has(ingredient.ean)
      ? liveStockMap.get(ingredient.ean)
      : 0, // Item removed from API = out of stock
  }));
}

/**
 * STEP 6 — Propose a combo of ingredients for the panino.
 * Randomly selects `count` ingredients from the available pool.
 * Prioritizes in-stock items and variety (different categories).
 *
 * @param {Array} ingredients - Full list of panino-suitable ingredients
 * @param {number} count - How many to pick (default: 4)
 * @returns {Array} - Selected ingredients for the combo
 */
function proposeCombo(ingredients, count = 4) {
  // Filter to in-stock items only
  const inStock = ingredients.filter((item) => item.stock > 0);
  const pool = inStock.length >= count ? inStock : ingredients;

  // Shuffle and pick
  const shuffled = [...pool].sort(() => Math.random() - 0.5);

  // Try category diversity: pick from different categories first
  const picked = [];
  const usedCategories = new Set();

  for (const item of shuffled) {
    if (picked.length >= count) break;
    if (!usedCategories.has(item.categoryEn)) {
      picked.push(item);
      usedCategories.add(item.categoryEn);
    }
  }

  // Fill remaining slots if needed (allow same category)
  for (const item of shuffled) {
    if (picked.length >= count) break;
    if (!picked.includes(item)) {
      picked.push(item);
    }
  }

  return picked;
}

/**
 * STEP 7 — AI Recipe Generation (Chef + Inspector pipeline).
 *
 * @param {Array} selectedIngredients - The combo of ingredients
 * @returns {{ name: string, ingredients: string[], steps: string[] }}
 */
async function generateRecipe(selectedIngredients) {
  // Use English names for all user-facing output
  const ingredientList = selectedIngredients
    .map((item) => `- ${item.productNameEn || item.productName} (${item.categoryEn})`)
    .join("\n");

  // ── Chef Agent ──
  const chefPrompt = `
You are a creative sandwich Chef. Build a gourmet panino using ONLY these available ingredients:

${ingredientList}

IMPORTANT: All output MUST be in English. The sandwich name, ingredient names, and steps must all be in English.
Create a sandwich name in English that sounds appetizing.
List which ingredients you're using (in English) and brief assembly steps.

Respond ONLY in valid JSON:
{
  "name": "Sandwich Name in English",
  "ingredients": ["English ingredient 1", "English ingredient 2"],
  "steps": ["Step 1: ...", "Step 2: ..."]
}
  `;

  const chefResult = await premiumModel.generateContent(chefPrompt);
  const draftJSON = cleanJSON(chefResult.response.text());

  // ── Inspector Agent ──
  const inspectorPrompt = `
You are a strict Quality Control Agent. Review this sandwich JSON:
${draftJSON}

Rules:
1. It MUST have a bread/base and edible fillings.
2. Raw meat (chicken, pork, beef) MUST have a cooking step.
3. ALL text (name, ingredients, steps) MUST be in English. Translate any remaining Danish text to English.
4. If safe, return the EXACT same JSON. If unsafe, fix it and return the corrected JSON.

Respond ONLY in valid JSON.
  `;

  const inspectorResult = await liteModel.generateContent(inspectorPrompt);
  const safeJSON = cleanJSON(inspectorResult.response.text());

  return JSON.parse(safeJSON);
}

/**
 * STEP 9 — Generate step-by-step cooking instructions.
 *
 * @param {{ name: string, ingredients: string[], steps: string[] }} recipe
 * @returns {string} - Plain-text cooking instructions
 */
async function generateInstructions(recipe) {
  const prompt = `
You are a friendly cooking instructor. Write clear, step-by-step instructions for making this panino:

Name: ${recipe.name}
Ingredients: ${recipe.ingredients.join(", ")}
Assembly steps: ${recipe.steps.join("; ")}

IMPORTANT: Write EVERYTHING in English. No Danish words.
Write detailed but concise instructions that a beginner could follow.
Include preparation tips, assembly order, and any cooking needed.
Format as numbered steps. Keep it practical and fun.
  `;

  const result = await premiumModel.generateContent(prompt);
  return result.response.text().trim();
}

// ─── Full Pipeline (for standalone testing) ──────────────────────────────────

async function runFullPipeline() {
  console.log("═══════════════════════════════════════════════");
  console.log("  Netto Panino Maker — Backend Pipeline Test");
  console.log("═══════════════════════════════════════════════\n");

  const weekKey = getNettoWeek();
  console.log(`📅 Netto Week: ${weekKey}\n`);

  // Step 1
  console.log("📡 Step 1 — Fetching store data...");
  const storesData = await fetchStoreData();
  console.log(`   Found ${storesData.length} target store(s).\n`);

  if (storesData.length === 0) {
    console.log("😔 No target stores found. Try again later.");
    return;
  }

  // Step 2
  console.log("🏪 Step 2 — Selecting best store...");
  const best = selectBestStore(storesData);
  console.log(`   Winner: ${best.name} with ${best.uniqueCount} unique products.\n`);

  // Step 3
  console.log("🤖 Step 3 — AI filtering panino ingredients...");
  const paninoItems = await filterPaninoIngredients(best.clearances);
  console.log(`   AI identified ${paninoItems.length} sandwich-suitable items.\n`);

  // Step 4
  console.log("📋 Step 4 — Standardizing ingredient data...");
  const rawIngredients = standardizeIngredients(paninoItems);
  console.log(`   Standardized ${rawIngredients.length} ingredients.\n`);

  // Step 4b
  console.log("🌍 Step 4b — Translating Danish names to English...");
  const ingredients = await translateIngredients(rawIngredients);
  ingredients.forEach((item) => {
    console.log(
      `   • ${item.productNameEn} (was: ${item.productName}) — ${item.newPrice} DKK (was ${item.originalPrice}, -${item.percentDiscount}%) [stock: ${item.stock}]`
    );
  });
  console.log();

  // Step 6
  console.log("🎲 Step 6 — Proposing ingredient combo...");
  const combo = proposeCombo(ingredients, 4);
  const totalPrice = combo.reduce((sum, i) => sum + i.newPrice, 0).toFixed(2);
  const totalOriginal = combo.reduce((sum, i) => sum + i.originalPrice, 0).toFixed(2);
  const totalSavings = (totalOriginal - totalPrice).toFixed(2);
  console.log(`   Selected ${combo.length} ingredients (${totalPrice} DKK, saving ${totalSavings} DKK):`);
  combo.forEach((item) => {
    console.log(`   🥖 ${item.productNameEn} — ${item.newPrice} DKK`);
  });
  console.log();

  // Step 7
  console.log("🧑‍🍳 Step 7 — Generating recipe (Chef + Inspector)...");
  const recipe = await generateRecipe(combo);
  console.log(`   🥪 ${recipe.name}`);
  console.log(`   Ingredients: ${recipe.ingredients.join(", ")}`);
  console.log(`   Steps: ${recipe.steps.length} steps\n`);

  // Step 9
  console.log("📝 Step 9 — Generating cooking instructions...");
  const instructions = await generateInstructions(recipe);
  console.log("\n" + instructions + "\n");

  console.log("═══════════════════════════════════════════════");
  console.log("  ✅ Pipeline complete!");
  console.log("═══════════════════════════════════════════════");
}

// ─── Exports ─────────────────────────────────────────────────────────────────
module.exports = {
  fetchStoreData,
  selectBestStore,
  filterPaninoIngredients,
  standardizeIngredients,
  translateIngredients,
  refreshStock,
  proposeCombo,
  generateRecipe,
  generateInstructions,
  getNettoWeek,
  // Config (for use in the RN app)
  SALLING_TOKEN,
  GEMINI_API_KEY,
  TARGET_STREETS,
  ZIP,
};

// ─── Run if executed directly ────────────────────────────────────────────────
if (require.main === module) {
  runFullPipeline().catch((err) => {
    console.error("\n❌ Pipeline failed:", err.message);
    process.exit(1);
  });
}
