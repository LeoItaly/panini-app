# Update Log

## 2026-03-21 — Completion Flow + History Vault (Iteration 3)

**Status:** Done

### What was done
- Installed `expo-image-picker`
- Created `hooks/RecipeContext.tsx` — `ActiveRecipe` shared state across tabs
- Updated `app/_layout.tsx` — wrapped root with `<RecipeProvider>`
- Updated `app/(tabs)/index.tsx`:
  - Imports `useRecipe` from `hooks/RecipeContext`
  - Calls `setActiveRecipe(parsed)` after Phase 2 completes
  - Added **"I MADE IT — CAPTURE →"** dark pill button (shown when `stage === 'done'`, recipe is not "Nothing Today")
  - Button navigates to Upload tab via `router.navigate('/(tabs)/upload')`
- Rewrote `app/(tabs)/upload.tsx`:
  - Reads live recipe from `RecipeContext` (empty state if null)
  - Prep text split into interactive step checklist
  - Real photo capture via `expo-image-picker` (Camera or Photo Library Alert)
  - Photo preview with retake option via `expo-image`
  - SAVE TO VAULT uploads photo to Supabase Storage then inserts vault record
- Rewrote `app/(tabs)/vault.tsx`:
  - Full-width photo header per card (200px; tap to expand 320px)
  - AI RECIPE section shows original `prep` text
  - Stats row updated: TOTAL / FAVOURITES / WITH PHOTO
  - Screen title changed to "History"

---

## 2026-03-21 — Re-Roll Feature + Two-Phase Pipeline (Iteration 2)

**Status:** Done

### What was done
- Split pipeline into Phase 1 (Salling fetch + Scout) and Phase 2 (Chef + Inspector + Translator)
- `SetupResult` cached after Phase 1; Re-Roll skips to Phase 2 directly
- `rollCount` state; roll badge on recipe card (🎲 Roll #2)
- Footer updated: RE-ROLL (yellow) + NEW SEARCH (ghost) when `canReRoll`
- Gemini models moved to module-level (instantiated once)
- Startup schedule check — auto-runs pipeline if today is scheduled + automation enabled
- `CheckingState` and `OffDayState` components added
- `errorHint` added to `ErrorState` (Re-Roll / New Search prompt)

---

## 2026-03-21 — Supabase Backend + Settings (Iteration 1.5)

**Status:** Done

### What was done
- Created `lib/supabase.ts` — Supabase client + `PHOTOS_BUCKET`
- Created `lib/db.ts` — all DB/storage helpers (vault CRUD, photo upload, settings R/W)
- Wired `vault.tsx` to Supabase (`getVaultRecipes`, `setFavorite`, `deleteRecipe`)
- Wired `upload.tsx` to Supabase (`saveRecipeToVault`, `uploadPaninoPhoto`)
- Wired `settings.tsx` to Supabase (`getSettings`, `updateSettings`)
- Installed: `@supabase/supabase-js`, `@react-native-async-storage/async-storage`,
  `expo-camera`, `@expo-google-fonts/plus-jakarta-sans`, `@expo-google-fonts/be-vietnam-pro`

---

## 2026-03-21 — Initial UI Implementation (Iteration 1)

**Status:** Done

### What was done
- Created `context/Context.md`, `context/Brand.md`, `context/Update.md`
- Updated `constants/theme.ts` — Digital Gastronome brand tokens
- Updated `components/ui/icon-symbol.tsx` — icon mappings for 4 tabs
- Rewrote `app/(tabs)/_layout.tsx` — 4 tabs with branded dark tab bar
- Rewrote `app/(tabs)/index.tsx` — Today screen with pipeline stage UI + recipe card
- Created `app/(tabs)/vault.tsx` — Panino Archive (placeholder)
- Created `app/(tabs)/upload.tsx` — Make & Capture (placeholder)
- Created `app/(tabs)/settings.tsx` — Automation Settings with schedule toggles

---

## 2026-03-21 — Project Scaffolded

Initial Expo project. `api_test.js` pipeline logic ported into `app/(tabs)/index.tsx`.
