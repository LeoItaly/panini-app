# Backend Logic — Netto Panino Maker

> Comprehensive reference for the data pipeline, caching strategy, AI agents, and screen navigation.

---

## 1. Netto Week Awareness

Salling Group Food Waste data refreshes every **Saturday** with the new week's discounted inventory. The pipeline is week-aware:

- On app launch, determine the **current Netto week** (`ISO week number`, Saturday → Friday cycle).
- Display a `NETTO WEEK #XX` badge on the Today screen header.
- All cached ingredient data is keyed to this week. When a new Netto week starts (Saturday), the cache auto-invalidates and the pipeline re-fetches.

---

## 2. Pipeline Overview (Sequential Steps)

```
┌────────────────────────────────────────────────────────────┐
│  STEP 1 — Fetch Store Data                                 │
│  GET /v1/food-waste?zip=2800                               │
│  Filter: Engelsborgvej + Jernbanepladsen only               │
├────────────────────────────────────────────────────────────┤
│  STEP 2 — Select Best Store                                │
│  Count unique products per store (by EAN or description)   │
│  Pick the store with the most items in promotion           │
│  (deterministic, no AI needed)                             │
├────────────────────────────────────────────────────────────┤
│  STEP 3 — AI Ingredient Filter                             │
│  Model: gemini-2.5-flash-lite                              │
│  Input: All clearance items from the winning store         │
│  Output: JSON array of items suitable for a sandwich       │
│  Cached for the entire Netto week (ingredients don't       │
│  change mid-week, only stock does)                         │
├────────────────────────────────────────────────────────────┤
│  STEP 4 — Standardize & Store Ingredient Data              │
│  Extract only the required columns per item:               │
│  ┌──────────────────────┬──────────────────────────────┐   │
│  │ App Field            │ API Source Path              │   │
│  ├──────────────────────┼──────────────────────────────┤   │
│  │ productName          │ product.description (Danish) │   │
│  │ productNameEn        │ AI-translated to English     │   │
│  │ productImage         │ product.image                │   │
│  │ categoryEn           │ product.categories.en        │   │
│  │ newPrice             │ offer.newPrice               │   │
│  │ originalPrice        │ offer.originalPrice          │   │
│  │ discount             │ offer.discount               │   │
│  │ percentDiscount      │ offer.percentDiscount        │   │
│  │ stock                │ offer.stock (live)           │   │
│  │ ean                  │ product.ean                  │   │
│  └──────────────────────┴──────────────────────────────┘   │
│  Store in local AsyncStorage keyed by Netto week.          │
├────────────────────────────────────────────────────────────┤
│  STEP 4b — Translate Danish Names to English               │
│  Model: gemini-2.5-flash-lite                              │
│  Batch-translate all productName (Danish) → productNameEn  │
│  in a single API call. All user-facing text uses            │
│  productNameEn. Cached alongside ingredient data.          │
├────────────────────────────────────────────────────────────┤
│  STEP 5 — Daily Stock Refresh                              │
│  offer.stock updates daily even within the same week.      │
│  On each app open (or resume), re-fetch ONLY stock         │
│  for the cached ingredients (match by EAN) and update      │
│  the local cache. Mark out-of-stock items (stock = 0).     │
├────────────────────────────────────────────────────────────┤
│  STEP 6 — Propose Ingredient Combo to User                 │
│  Select 3-6 panino-suitable items from cache.              │
│  Show each ingredient card with:                           │
│    • Product image (from product.image URL)                │
│    • Product name (already in English via categoryEn)      │
│    • Discounted price (newPrice)                           │
│    • Original price (originalPrice, struck through)        │
│    • Savings amount (discount)                             │
│    • Percentage off badge (percentDiscount%)               │
│    • Stock availability indicator                          │
│  Show total combo price and total savings.                 │
├────────────────────────────────────────────────────────────┤
│  STEP 7 — AI Recipe Generation                             │
│  Model: gemini-2.5-flash                                   │
│  Input: Selected ingredients + their names                 │
│  Output: { name, ingredients[], steps[] }                  │
│  Passed through Inspector (gemini-2.5-flash-lite)          │
│  for safety validation.                                    │
├────────────────────────────────────────────────────────────┤
│  STEP 8 — Re-Roll (optional)                               │
│  If user doesn't like the combo → re-select different      │
│  ingredients from the cache (no API call, no AI filter).   │
│  Re-generate recipe with new combo.                        │
│  Loop until user presses "LET'S COOK".                     │
├────────────────────────────────────────────────────────────┤
│  STEP 9 — Cooking Instructions                             │
│  Model: gemini-2.5-flash                                   │
│  Input: Final recipe JSON                                  │
│  Output: Step-by-step cooking instructions (plain text)    │
│  Displayed on the Instructions screen.                     │
├────────────────────────────────────────────────────────────┤
│  STEP 10 — Capture & Save to Vault                         │
│  User uploads a photo of the finished panino.              │
│  Saved to Supabase Storage + vault table with:             │
│    • panino_name                                           │
│    • store                                                 │
│    • total_price (sum of discounted prices)                │
│    • photo_url                                             │
│    • ingredients[]                                         │
│    • created_at                                            │
└────────────────────────────────────────────────────────────┘
```

---

## 3. AI Agents (Refined from api_test.js)

All agents use the `@google/generative-ai` SDK. Two Gemini model tiers for rate-limit balancing:

| Agent | Model | Purpose |
|-------|-------|---------|
| **Ingredient Filter** | `gemini-2.5-flash-lite` | Identify which clearance items are sandwich-suitable |
| **Translator** | `gemini-2.5-flash-lite` | Batch-translate Danish product names to English |
| **Recipe Chef** | `gemini-2.5-flash` | Compose a panino from the selected ingredients |
| **Safety Inspector** | `gemini-2.5-flash-lite` | Validate recipe (no raw meat, has bread) + enforce English |
| **Instruction Writer** | `gemini-2.5-flash` | Generate step-by-step cooking instructions (English) |

### Key changes from the old 4-agent pipeline (api_test.js):
- **Removed** the Scout agent — replaced by deterministic "most promo items" logic. No AI needed for store selection.
- **Kept** the Translator agent — batch-translates all Danish product names to English in one API call. All user-facing text is in English.
- **Added** Ingredient Filter agent — identifies panino-suitable items.
- **Added** Instruction Writer agent — generates detailed cooking steps.
- **Inspector now also enforces English** — any remaining Danish text gets caught and translated.

---

## 4. Caching Strategy

### Weekly Cache (AsyncStorage)
```
Key:    "panino_ingredients_week_{YYYY}_{WW}"
Value:  JSON array of standardized ingredient objects
TTL:    Auto-invalidated when Netto week changes (Saturday)
```

**What is cached (weekly):**
- `productName`, `productImage`, `categoryEn`, `newPrice`, `originalPrice`, `discount`, `percentDiscount`, `ean`

**What is NOT cached (fetched daily):**
- `stock` — re-fetched on each app open and merged into the cached ingredient list by EAN

### Cache Flow
```
App Open
  ├── Is cache valid for current Netto week?
  │     ├── YES → Load from cache → Refresh stock only → Ready
  │     └── NO  → Run full pipeline (Steps 1-4) → Cache result → Ready
  └── Display ingredients to user
```

---

## 5. Screen Navigation

Three main tabs + sub-screens:

```
┌────────────────────────────────────────────────┐
│                TAB BAR                          │
│  🍴 Home    |    🗄 Vault    |    ⚙ Settings    │
└────────────────────────────────────────────────┘
```

### Home Tab (Today)
```
Home
  ├── Idle State: "Ready to fight food waste?" + MAKE PANINO button
  ├── Loading State: Pipeline progress indicator
  ├── Ingredients State: Ingredient cards with prices/images
  │     ├── RE-ROLL → reshuffles ingredients, re-generates recipe
  │     └── LET'S COOK → navigates to Instructions sub-screen
  └── Instructions Sub-Screen (push, not tab)
        ├── Step-by-step cooking guide
        ├── Ingredient checklist
        ├── DONE COOKING → navigates to Capture sub-screen
        └── ← Back → returns to ingredients
```

### Vault Tab (History)
```
Vault
  ├── Stats Row: TOTAL / FAVOURITES / WITH PHOTO
  ├── List of past paninos
  │     ├── Photo (tap to expand)
  │     ├── Panino name + store badge + date
  │     ├── Total price paid (discounted)
  │     ├── Ingredients list
  │     ├── ★ Favourite toggle
  │     └── 🗑 Delete (with confirm)
  └── Empty state if no records
```

### Settings Tab
```
Settings
  ├── Weekly schedule toggles (Mon–Sun)
  ├── Store preference (Engelsborgvej / Jernbanepladsen / Both)
  ├── Time picker
  └── Automation master toggle
```

### Navigation Rules
- **Back from Instructions** → Returns to Home with ingredients still showing
- **Back from Capture** → Returns to Instructions
- **Tab switches** preserve state within each tab
- **Re-Roll** is always available until "LET'S COOK" is pressed
- **New Search** resets everything and goes back to Idle state

---

## 6. Data Schema — Ingredient Object

The standardized ingredient stored in cache and displayed in the app:

```typescript
interface PaninoIngredient {
  ean: string;                // Unique product identifier
  productName: string;        // product.description (original Danish)
  productNameEn: string;      // AI-translated English name (shown to user)
  productImage: string;       // product.image URL
  categoryEn: string;         // product.categories.en
  newPrice: number;           // offer.newPrice (discounted)
  originalPrice: number;      // offer.originalPrice
  discount: number;           // offer.discount (absolute DKK amount)
  percentDiscount: number;    // offer.percentDiscount (e.g. 30)
  stock: number;              // offer.stock (refreshed daily)
}
```

---

## 7. Scripts Reference

All backend logic lives in `scripts/backend_service.js` — a single modular file exporting the following functions:

| Function | Description |
|----------|-------------|
| `fetchStoreData()` | Fetch food-waste data, filter for 2 target stores |
| `selectBestStore(storesData)` | Deterministic: pick store with most unique products |
| `filterPaninoIngredients(items)` | AI: identify sandwich-suitable items via Gemini Lite |
| `standardizeIngredients(items)` | Extract & clean only required columns |
| `translateIngredients(ingredients)` | AI: batch-translate Danish names → English |
| `refreshStock(cachedIngredients)` | Re-fetch stock for cached items by EAN |
| `proposeCombo(ingredients, count)` | Select a random combo of N ingredients |
| `generateRecipe(ingredients)` | AI: Chef + Inspector pipeline (English output) |
| `generateInstructions(recipe)` | AI: step-by-step cooking guide (English) |
| `getNettoWeek()` | Calculate current Netto week identifier |
| `isCacheValid(weekKey)` | Check if weekly cache exists and is current |

### Deleted Scripts
- ~~`api_test.js`~~ — logic merged into `backend_service.js`
- ~~`most_promo_food_store.js`~~ — logic merged into `selectBestStore()`
- ~~`columns_salling_group.js`~~ — schema is already documented; no longer needed
