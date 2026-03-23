# Netto Panino Maker — App Context

## Concept

Netto Panino Maker is a client-side React Native (Expo) app that fights food waste. It fetches live discounted grocery inventory from local Netto stores in Denmark via the Salling Group food-waste API, then runs a 4-agent Google Gemini AI pipeline to invent a gourmet panino recipe from those discounted ingredients.

The user can photograph their finished panino. The photo is uploaded to Supabase Storage and the full record (name, store, recipe, photo URL) is persisted to the Supabase vault table. The app follows a 10-step autonomous pipeline, culminating in user manual selection:

1.  **Schedule Check:** The app checks the user's settings (active days, time).
2.  **Fetch Live Discounts:** Calls the Salling Group API for target streets (Engelsborgvej, Jernbanepladsen) to get real-time clearance items.
3.  **Store Selection:** Selects the store with the most unique promotional products.
4.  **AI Filtering (Gemini Lite):** Filters the raw data to remove non-sandwich items (cleaning supplies, drinks, candy, etc.).
5.  **Standardization:** Maps the data to a uniform `PaninoIngredient` format (EAN, image, pricing).
6.  **Translation (Gemini Lite):** Translates Danish product names to short, appetizing English.
7.  **Manual Selection Preview (UI):** ALL valid ingredient cards are displayed in a grid for the selected store. Re-fetching occurs only if cache expires (weekly), otherwise only stocks are refreshed daily.
8.  **User Grid Interaction:** The user manually taps `IngredientCard`s to build their combo. "LET'S COOK" generates a recipe.
9.  **AI Chef (Gemini 2.5 Flash):** Given the user's hand-picked combo, the Chef Agent designs an English recipe (Name, ingredients, assembly steps).
10. **AI Formatting:** A final pass creates concise, professional, bulleted cooking instructions without fluff.

---

## Data Flow

```
Salling Group API  (food-waste, zip=2800)
        |
  Raw store + clearance items JSON
        |
  Step 1-2: Fetch + select best store (deterministic, most items)
        |
  Step 3: AI Ingredient Filter (gemini-2.5-flash-lite)
        |
  Step 4: Standardize + Translate names to English
        |
  Ingredient cards shown on Today screen (prices, images, discounts)
        |
  User: RE-ROLL (instant) or LET'S COOK
        |
  Step 7: Chef + Inspector → recipe JSON
  Step 9: Instruction Writer → cooking guide
        |
  Instructions screen (push from Today)
        |
  "I MADE IT — CAPTURE"
        |
  expo-image-picker: camera or gallery
        |
  Photo → Supabase Storage (panino-photos bucket)
        |
  Full record → Supabase vault table
        |
  Vault tab
```

---

## AI Agents (New Pipeline)

### Ingredient Pipeline (cached weekly)

Runs once per Netto week. Re-Roll skips it entirely.

| Agent | Model | Input | Output |
|-------|-------|-------|--------|
| Ingredient Filter | gemini-2.5-flash-lite | All clearance items | `{ suitable_indices: [...] }` |
| Translator | gemini-2.5-flash-lite | Danish product names | `{ translations: [...] }` |

### Recipe Pipeline (re-runnable per LET'S COOK)

| Agent | Model | Input | Output |
|-------|-------|-------|--------|
| Chef | gemini-2.5-flash | Selected combo (English) | `{ name, ingredients[], steps[] }` |
| Inspector | gemini-2.5-flash-lite | Chef JSON | Corrected/unchanged JSON |
| Instruction Writer | gemini-2.5-flash | Final recipe JSON | Plain-text cooking guide |

### Re-Roll
- Skips both pipelines, reuses cached ingredients
- Calls `proposeCombo()` locally for an instant shuffle
- Shows new ingredient cards immediately
- Roll badge: 🎲 Roll #N

---

## Shared State — RecipeContext

**File:** `hooks/RecipeContext.tsx`
**Provider:** `<RecipeProvider>` in `app/_layout.tsx`

```typescript
interface PaninoIngredient {
  ean: string;
  productName: string;        // Danish original
  productNameEn: string;      // Translated English
  productImage: string | null;
  categoryEn: string;
  newPrice: number;
  originalPrice: number;
  discount: number;
  percentDiscount: number;
  stock: number;
}

interface ActiveRecipe {
  panino: string;
  store: string;
  combo: PaninoIngredient[];
  recipe: GeneratedRecipe;
  instructions: string;
  totalPrice: number;
  totalOriginal: number;
  totalSavings: number;
}
```

- **Set by** `index.tsx` after LET'S COOK completes
- **Read by** `instructions.tsx` for the cooking guide + `upload.tsx` for the vault save

---

## Stores Monitored

| Store | Street | Zip |
|-------|--------|-----|
| Netto Engelsborgvej | Engelsborgvej | 2800 |
| Netto Jernbanepladsen | Jernbanepladsen | 2800 |

---

## Navigation

| Tab / Screen | File | Purpose |
|-----|------|---------|
| Today | `app/(tabs)/index.tsx` | Pipeline, ingredient cards, LET'S COOK, Re-Roll |
| Vault | `app/(tabs)/vault.tsx` | All saved records with photos + AI recipe |
| Settings | `app/(tabs)/settings.tsx` | Automation schedule preferences |
| Instructions | `app/instructions.tsx` | Full cooking guide (push screen from Today) |

---

## Backend — Supabase

Project: `hiscxstqogunloawfutu.supabase.co`

### vault table
| Column | Type | Notes |
|--------|------|-------|
| id | uuid PK | auto |
| panino_name | text | |
| store | text | |
| ingredients | text[] | |
| prep | text | AI original prep text |
| photo_url | text | Public HTTPS URL |
| is_favorite | boolean | default false |
| created_at | timestamptz | auto |

### settings table (single row, id=1)
| Column | Type |
|--------|------|
| active_days | text[] |
| preferred_store | text |
| scheduled_time | text |
| automation_enabled | boolean |

### Storage
- Bucket: `panino-photos` (public)
- Naming: `panino_<timestamp>.jpg`

### Client files
- `lib/supabase.ts` — client + `PHOTOS_BUCKET` constant
- `lib/db.ts` — all helpers; screens import from here only

---

## History Vault Screen

- `getVaultRecipes()` — all records newest first
- `useFocusEffect` — refreshes on every tab focus
- Stats: **TOTAL / FAVOURITES / WITH PHOTO**
- Each card:
  - Full-width photo header (200px; tap to expand to 320px) via `expo-image`
  - Panino name + ★ favourite toggle (optimistic)
  - Store badge (Basil Green) + date
  - INGREDIENTS (dot-separated)
  - AI RECIPE — original `prep` text
  - Remove (confirm alert + Storage delete)

---

## Key Libraries (all installed)

| Package | Purpose |
|---------|---------|
| `@google/generative-ai` | Gemini AI SDK |
| `expo-router` | File-based navigation |
| `@supabase/supabase-js` | Database + Storage |
| `expo-image-picker` | Camera + photo library |
| `expo-image` | Efficient image rendering |
| `@expo-google-fonts/plus-jakarta-sans` | Headline font |
| `@expo-google-fonts/be-vietnam-pro` | Body font |
| `@react-native-async-storage/async-storage` | Installed, unused |
| `expo-camera` | Installed, unused |

---

## File Map

```
app/
  _layout.tsx          RecipeProvider + ThemeProvider + Stack
  instructions.tsx     Cooking guide (push screen from Today)
  (tabs)/
    _layout.tsx        Tab bar (4 tabs, Ink Black bar, Yellow active)
    index.tsx          Today — ingredient pipeline, cards, LET'S COOK
    vault.tsx          History Vault — photo cards, AI recipe, fav/delete
    settings.tsx       Automation settings
    IngredientCard.tsx  # Modular, reusable card showing image, price, discount, and selection state
    haptic-tab.tsx
    IconSymbol.tsx
    ui/
hooks/
  RecipeContext.tsx    ActiveRecipe + PaninoIngredient shared state
  use-color-scheme.ts
  use-theme-color.ts
context/
  Context.md           This file
  Brand.md             Design system reference
  Update.md            Change log
  backend_logic.md     Full pipeline logic reference
  salling_food_waste_schema.md  API schema
scripts/
  backend_service.js   Unified backend pipeline module
lib/
  supabase.ts          Supabase client + PHOTOS_BUCKET
  db.ts                getVaultRecipes, saveRecipeToVault, uploadPaninoPhoto,
                       setFavorite, deleteRecipe, getSettings, updateSettings
constants/
  theme.ts             BrandColors, FontFamily, Spacing, Radius
```
