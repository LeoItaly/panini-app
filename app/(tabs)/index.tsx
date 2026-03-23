/**
 * Today's Panino — main screen.
 *
 * New pipeline flow (from backend_logic.md):
 *   1. Fetch store data → 2. Select best store → 3. AI filter ingredients
 *   → 4. Standardize + translate → 5. Propose combo → Show ingredient cards
 *   → User: RE-ROLL or LET'S COOK → 6. Generate recipe + instructions → Done
 */
import React, { useState, useEffect, useCallback } from 'react';
import {
  View,
  Text,
  ScrollView,
  StyleSheet,
  TouchableOpacity,
  StatusBar,
  ActivityIndicator,
  Linking,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { router, useFocusEffect } from 'expo-router';
import { GoogleGenerativeAI } from '@google/generative-ai';
import { BrandColors, Spacing, Radius, FontFamily } from '@/constants/theme';
import { getSettings } from '@/lib/db';
import {
  useRecipe,
  PaninoIngredient,
  GeneratedRecipe,
} from '@/hooks/RecipeContext';
import { IngredientCard } from '@/components/IngredientCard';

// ─── API Keys ────────────────────────────────────────────────────────────────
const GEMINI_API_KEY = process.env.EXPO_PUBLIC_GEMINI_API_KEY || '';
const SALLING_TOKEN = process.env.EXPO_PUBLIC_SALLING_TOKEN || '';
const ZIP = '2800';
const TARGET_STREETS = ['Engelsborgvej', 'Jernbanepladsen'];

// ─── Gemini models (module-level — instantiated once) ────────────────────────
const genAI = new GoogleGenerativeAI(GEMINI_API_KEY);
const premiumModel = genAI.getGenerativeModel({ model: 'gemini-2.5-flash' });
const liteModel = genAI.getGenerativeModel({ model: 'gemini-2.5-flash-lite' });

// ─── Types ────────────────────────────────────────────────────────────────────
type Stage =
  | 'checking'
  | 'idle'
  | 'fetching'
  | 'filtering'
  | 'translating'
  | 'ingredients_preview' // User reviews ingredient cards
  | 'generating_recipe'
  | 'generating_instructions'
  | 'done'
  | 'error';

// Day abbreviations aligned with JS Date.getDay() (0 = Sunday)

// ─── Helpers (inlined from backend_service.js for RN compatibility) ──────────

function cleanJSON(text: string): string {
  return text.replace(/```json/gi, '').replace(/```/g, '').trim();
}

function getNettoWeek(): string {
  const d = new Date();
  const day = d.getDay();
  const saturdayOffset = day >= 6 ? 0 : -(day + 1);
  d.setDate(d.getDate() + saturdayOffset);
  const janFirst = new Date(d.getFullYear(), 0, 1);
  const dayOfYear = Math.ceil((d.getTime() - janFirst.getTime()) / 86400000) + 1;
  const weekNum = Math.ceil(dayOfYear / 7);
  return `${d.getFullYear()}_${String(weekNum).padStart(2, '0')}`;
}

async function fetchStoreData() {
  const url = `https://api.sallinggroup.com/v1/food-waste?zip=${ZIP}`;
  const response = await fetch(url, {
    headers: { Authorization: `Bearer ${SALLING_TOKEN}` },
  });
  if (!response.ok) throw new Error(`Salling API Error: ${response.status}`);
  const allStores = await response.json();
  return allStores.filter((store: any) => {
    const street = store?.store?.address?.street || '';
    return TARGET_STREETS.some((t) => street.includes(t));
  });
}

function selectBestStore(storesData: any[], preferredStore: string) {
  if (!storesData.length) return null;

  let availableStores = storesData;
  if (preferredStore && preferredStore !== 'Both') {
    availableStores = storesData.filter((store: any) => {
      const street = store?.store?.address?.street || '';
      return street.includes(preferredStore);
    });
  }

  if (!availableStores.length) return null;

  const results = availableStores.map((store: any) => {
    const street = store?.store?.address?.street || 'Unknown';
    const clearances = store?.clearances || [];
    const uniqueProducts = new Set<string>();
    for (const item of clearances) {
      const ean = item?.product?.ean;
      const desc = item?.product?.description;
      if (ean) uniqueProducts.add(`ean:${ean}`);
      else if (desc) uniqueProducts.add(`desc:${desc.trim().toLowerCase()}`);
    }
    const name = TARGET_STREETS.find((t) => street.includes(t)) || street;
    return { store, name, uniqueCount: uniqueProducts.size, clearances };
  });
  results.sort((a: any, b: any) => b.uniqueCount - a.uniqueCount);
  return results[0];
}

async function filterPaninoIngredients(clearances: any[]): Promise<any[]> {
  const itemList = clearances
    .map((item: any, i: number) => {
      const desc = item?.product?.description || 'Unknown';
      const cat = item?.product?.categories?.en || item?.product?.categories?.da || '';
      return `${i + 1}. ${desc} (${cat})`;
    })
    .join('\n');

  const prompt = `You are a sandwich ingredient expert. Below is a numbered list of discounted grocery items from a Danish supermarket.\n\n${itemList}\n\nIdentify which items could be used as sandwich (panino) ingredients: bread, cheese, deli meats, spreads, vegetables, condiments, etc.\nExclude: ready meals, desserts, drinks, pet food, cleaning products, candy, frozen dinners.\n\nRespond ONLY in valid JSON: { "suitable_indices": [1, 3, 5, ...] }`;

  const result = await liteModel.generateContent(prompt);
  const parsed = JSON.parse(cleanJSON(result.response.text()));
  return (parsed.suitable_indices || []).map((i: number) => clearances[i - 1]).filter(Boolean);
}

function standardizeIngredients(items: any[]): PaninoIngredient[] {
  return items.map((item: any) => ({
    ean: item?.product?.ean || `no-ean-${Date.now()}-${Math.random()}`,
    productName: item?.product?.description || 'Unknown Product',
    productNameEn: '', // Will be filled by translateIngredients
    productImage: item?.product?.image || null,
    categoryEn: item?.product?.categories?.en || item?.product?.categories?.da || 'Uncategorized',
    newPrice: item?.offer?.newPrice ?? 0,
    originalPrice: item?.offer?.originalPrice ?? 0,
    discount: item?.offer?.discount ?? 0,
    percentDiscount: item?.offer?.percentDiscount ?? 0,
    stock: item?.offer?.stock ?? 0,
  }));
}

async function translateIngredients(ingredients: PaninoIngredient[]): Promise<PaninoIngredient[]> {
  const danishNames = ingredients.map((i) => i.productName);
  const prompt = `You are a translator for a Danish grocery app. Translate each Danish product name below into natural, appetizing English.\nKeep it short (max 4-5 words per name). Do NOT add descriptions.\n\nDanish names:\n${danishNames.map((n, i) => `${i + 1}. ${n}`).join('\n')}\n\nRespond ONLY in valid JSON:\n{ "translations": ["English Name 1", "English Name 2", ...] }\n\nThe array MUST have exactly ${danishNames.length} entries, one per input, in the same order.`;

  try {
    const result = await liteModel.generateContent(prompt);
    const parsed = JSON.parse(cleanJSON(result.response.text()));
    const translations: string[] = parsed.translations || [];
    return ingredients.map((item, i) => ({
      ...item,
      productNameEn: translations[i] || item.productName,
    }));
  } catch {
    return ingredients.map((item) => ({ ...item, productNameEn: item.productName }));
  }
}

async function refreshStock(cachedIngredients: PaninoIngredient[], storeName: string): Promise<PaninoIngredient[]> {
  const storesData = await fetchStoreData();
  const store = storesData.find((s: any) => {
    const street = s?.store?.address?.street || '';
    return street.includes(storeName);
  });

  if (!store) return cachedIngredients;

  const liveStockMap = new Map();
  for (const item of store.clearances || []) {
    const ean = item?.product?.ean;
    if (ean) liveStockMap.set(ean, item?.offer?.stock ?? 0);
  }

  return cachedIngredients.map((ingredient) => ({
    ...ingredient,
    stock: liveStockMap.has(ingredient.ean) ? liveStockMap.get(ingredient.ean) : 0,
  }));
}

async function cleanupOldCaches(currentWeekKey: string) {
  try {
    const keys = await AsyncStorage.getAllKeys();
    const oldKeys = keys.filter(
      (k) => k.startsWith('panino_ingredients_') && k !== currentWeekKey
    );
    if (oldKeys.length > 0) {
      await AsyncStorage.multiRemove(oldKeys);
      console.log(`🧹 Cleaned up ${oldKeys.length} old Netto caches.`);
    }
  } catch (err) {
    console.warn('⚠️ Failed to clean old caches:', err);
  }
}

async function generateRecipe(combo: PaninoIngredient[]): Promise<GeneratedRecipe> {
  const list = combo.map((i) => `- ${i.productNameEn || i.productName} (${i.categoryEn})`).join('\n');

  const chefPrompt = `You are an AI that creates one simple recipe from discounted supermarket ingredients.

Choose one of these:
- panini
- sandwich
- burger
- hot dog
- toasted sandwich

Keep it simple and realistic.

Guidelines:
- choose exactly 1 bread
- choose exactly 1 main filling
- add a few ingredients that fit well together
- prefer discounted ingredients
- do not overload the recipe
- make sure the combination makes sense

If several options are possible, choose the one that feels most natural and tasty.

IMPORTANT: All output MUST be in English.
Respond ONLY in valid JSON matching this structure:
{
  "name": "Creative English Recipe Name",
  "recipe_type": "panini",
  "ingredients": ["ingredient 1"],
  "reason": "short reason why it works",
  "steps": ["Step 1: ..."]
}

Ingredients:
${list}`;

  const chefResult = await premiumModel.generateContent(chefPrompt);
  const draftJSON = cleanJSON(chefResult.response.text());

  const inspectorPrompt = `You are a strict Quality Control Agent. Review this sandwich JSON:\n${draftJSON}\n\nRules:\n1. MUST have exactly 1 bread/base and edible fillings.\n2. Raw meat MUST have a cooking step.\n3. ALL text MUST be in English.\n4. If safe, return EXACT same JSON. If unsafe, fix it.\n\nRespond ONLY in valid JSON.`;

  const inspectorResult = await liteModel.generateContent(inspectorPrompt);
  const parsed = JSON.parse(cleanJSON(inspectorResult.response.text()));
  
  return {
    name: parsed.name || parsed.recipe_type || 'Custom Panino',
    ingredients: parsed.ingredients || [],
    steps: parsed.steps || []
  };
}

async function generateInstructions(recipe: GeneratedRecipe): Promise<string> {
  const prompt = `Write a step-by-step guide to prepare this recipe.

Name: ${recipe.name}
Ingredients: ${recipe.ingredients.join(', ')}
Steps: ${recipe.steps.join('; ')}

GUIDELINES:
- Output MUST be much shorter and concise.
- NO introduction (do not write "Ready to create", "Here is...", etc.).
- NO creative fluff. Be strictly professional.
- Start directly with a numbered list of instructions (1. First step, 2. Second step, etc.). Break each step into a new line.
- Keep the number of steps small.

IMPORTANT: EVERYTHING in English. No Danish.`;

  const result = await premiumModel.generateContent(prompt);
  return result.response.text().trim();
}

// ─── Sub-components ───────────────────────────────────────────────────────────

const PIPELINE_STEPS: { key: Stage; label: string; emoji: string }[] = [
  { key: 'fetching', label: 'Fetching live discounts', emoji: '📡' },
  { key: 'filtering', label: 'AI filtering ingredients', emoji: '🤖' },
  { key: 'translating', label: 'Translating to English', emoji: '🌍' },
];

const RECIPE_STEPS: { key: Stage; label: string; emoji: string }[] = [
  { key: 'generating_recipe', label: 'Chef composing recipe', emoji: '🧑‍🍳' },
  { key: 'generating_instructions', label: 'Writing instructions', emoji: '📝' },
];

const STAGE_ORDER: Stage[] = [
  'idle', 'fetching', 'filtering', 'translating', 'ingredients_preview',
  'generating_recipe', 'generating_instructions', 'done',
];

function PipelineProgress({
  stage,
  steps,
}: {
  stage: Stage;
  steps: { key: Stage; label: string; emoji: string }[];
}) {
  const currentIdx = STAGE_ORDER.indexOf(stage);
  return (
    <View style={styles.pipelineCard}>
      {steps.map((step) => {
        const stepIdx = STAGE_ORDER.indexOf(step.key);
        const isComplete = currentIdx > stepIdx;
        const isActive = stage === step.key;
        return (
          <View key={step.key} style={[styles.pipelineRow, isActive && styles.pipelineRowActive]}>
            <Text style={styles.pipelineEmoji}>{step.emoji}</Text>
            <Text
              style={[
                styles.pipelineLabel,
                isActive && styles.pipelineLabelActive,
                isComplete && styles.pipelineLabelDone,
              ]}>
              {step.label}
            </Text>
            <View style={styles.pipelineStatus}>
              {isActive && !isComplete && (
                <ActivityIndicator size="small" color={BrandColors.primaryContainer} />
              )}
              {isComplete && (
                <View style={styles.checkCircle}>
                  <Text style={styles.checkMark}>✓</Text>
                </View>
              )}
            </View>
          </View>
        );
      })}
    </View>
  );
}

function ErrorState({ message }: { message: string }) {
  return (
    <View style={styles.errorCard}>
      <Text style={styles.errorEmoji}>❌</Text>
      <Text style={styles.errorTitle}>Pipeline Failed</Text>
      <Text style={styles.errorMessage}>{message}</Text>
      <Text style={styles.errorHint}>
        You can try a New Search to reload the pipeline.
      </Text>
    </View>
  );
}

// ─── Main Screen ─────────────────────────────────────────────────────────────
export default function TodayScreen() {
  const [stage, setStage] = useState<Stage>('fetching');
  const [allIngredients, setAllIngredients] = useState<PaninoIngredient[]>([]);
  const [selectedEans, setSelectedEans] = useState<Set<string>>(new Set());
  const [storeName, setStoreName] = useState('');
  const [error, setError] = useState('');
  const { setActiveRecipe } = useRecipe();

  const weekKey = getNettoWeek();
  const isLoadingIngredients = stage === 'fetching' || stage === 'filtering' || stage === 'translating';
  const isLoadingRecipe = stage === 'generating_recipe' || stage === 'generating_instructions';
  const isAnyLoading = isLoadingIngredients || isLoadingRecipe;

  // ── Phase 1: Fetch → Filter → Translate → Show Ingredients ────────────────
  const runIngredientPipeline = useCallback(async () => {
    setStage('fetching');
    setError('');
    setSelectedEans(new Set());
    setAllIngredients([]);
    setActiveRecipe(null);

    try {
      const settings = await getSettings();
      const prefStore = settings.preferred_store || 'Both';
      const safePref = prefStore.replace(/[^a-zA-Z0-9]/g, '_');
      const weekKey = `panino_ingredients_${safePref}_${getNettoWeek()}`;

      // 1. Check weekly cache first
      const cachedStr = await AsyncStorage.getItem(weekKey);
      if (cachedStr) {
        setStage('translating'); // Reuse ui loader state just to feel quick
        const cachedArr = JSON.parse(cachedStr);
        // Cached format: { storeName: string, items: PaninoIngredient[] }
        if (cachedArr.storeName && cachedArr.items) {
          setStoreName(cachedArr.storeName);
          // Refresh ONLY stock instead of full AI pipeline
          const freshStock = await refreshStock(cachedArr.items, cachedArr.storeName);
          const mappedStock = freshStock.filter(i => i.stock > 0);
          setAllIngredients(mappedStock);
          setStage('ingredients_preview');
          cleanupOldCaches(weekKey); // Run silently in background
          return;
        }
      }

      // 2. If no valid cache, run the full pipeline
      const storesData = await fetchStoreData();
      if (storesData.length === 0) {
        setError('No target stores found. Try again later.');
        setStage('error');
        return;
      }

      const best = selectBestStore(storesData, prefStore);
      if (!best || best.clearances.length === 0) {
        setError('No discounted items at your stores right now.');
        setStage('error');
        return;
      }
      setStoreName(best.name);

      setStage('filtering');
      const paninoItems = await filterPaninoIngredients(best.clearances);
      if (paninoItems.length === 0) {
        setError('No sandwich-suitable ingredients found in discounts.');
        setStage('error');
        return;
      }

      const standardized = standardizeIngredients(paninoItems);

      setStage('translating');
      const translated = await translateIngredients(standardized);
      
      // Save full result to cache for the week
      await AsyncStorage.setItem(weekKey, JSON.stringify({
        storeName: best.name,
        items: translated
      }));
      cleanupOldCaches(weekKey); // Run silently in background

      const mappedStock = translated.filter(i => i.stock > 0);
      setAllIngredients(mappedStock);
      setStage('ingredients_preview');
    } catch (err) {
      console.error('❌ Ingredient pipeline failed:', err);
      setError(err instanceof Error ? err.message : 'Pipeline failed.');
      setStage('error');
    }
  }, [setActiveRecipe]);

  // ── LET'S COOK: Generate recipe + instructions from selected combo ────────
  const handleLetsCook = useCallback(async () => {
    if (selectedEans.size === 0) return;
    const selectedCombo = allIngredients.filter(i => selectedEans.has(i.ean));
    setStage('generating_recipe');

    try {
      const recipe = await generateRecipe(selectedCombo);

      setStage('generating_instructions');
      const instructions = await generateInstructions(recipe);

      const totalPrice = selectedCombo.reduce((s, i) => s + i.newPrice, 0);
      const totalOriginal = selectedCombo.reduce((s, i) => s + i.originalPrice, 0);

      setActiveRecipe({
        panino: recipe.name,
        store: storeName,
        combo: selectedCombo,
        recipe,
        instructions,
        totalPrice,
        totalOriginal,
        totalSavings: totalOriginal - totalPrice,
      });

      // Reset today tab so they can cook another panino later, and jump straight to instructions
      setStage('ingredients_preview');
      setSelectedEans(new Set());
      router.push('/instructions');
    } catch (err) {
      console.error('❌ Recipe generation failed:', err);
      setError(err instanceof Error ? err.message : 'Recipe generation failed.');
      setStage('error');
    }
  }, [allIngredients, selectedEans, storeName, setActiveRecipe]);

  const handleRetry = useCallback(() => {
    setStage('fetching');
    setSelectedEans(new Set());
    setAllIngredients([]);
    setError('');
    setActiveRecipe(null);
    runIngredientPipeline();
  }, [runIngredientPipeline, setActiveRecipe]);

  // ── Startup: auto-run pipeline when tab is focused ──────────
  useFocusEffect(
    useCallback(() => {
      runIngredientPipeline();
    }, [runIngredientPipeline])
  );

  return (
    <SafeAreaView style={styles.safeArea}>
      <StatusBar barStyle="dark-content" backgroundColor={BrandColors.background} />

      {/* ── Header ── */}
      <View style={styles.header}>
        <View>
          <Text style={styles.headerLabel}>NETTO · WEEK {weekKey.split('_')[1]}</Text>
          <Text style={styles.headerTitle}>Panino Maker</Text>
        </View>
        <View style={styles.headerBadge}>
          <Text style={styles.headerBadgeText}>🇩🇰</Text>
        </View>
      </View>

      {/* ── Content ── */}
      <ScrollView
        style={styles.scroll}
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}>

        {/* Ingredient fetching pipeline */}
        {isLoadingIngredients && (
          <View>
            <Text style={styles.pipelineTitle}>Finding Your Ingredients…</Text>
            <PipelineProgress stage={stage} steps={PIPELINE_STEPS} />
          </View>
        )}

        {/* Ingredient cards preview */}
        {stage === 'ingredients_preview' && allIngredients.length > 0 && (
          <View>
            <View style={styles.storeHeaderBlock}>
              <Text style={styles.storeHeaderSubtitle}>YOUR STORE</Text>
              <Text style={styles.storeHeaderTitle}>{storeName}</Text>
              <TouchableOpacity
                style={styles.directionsBtn}
                onPress={() => Linking.openURL(`https://maps.apple.com/?q=${encodeURIComponent(storeName + ' Netto')}`)}>
                <Text style={styles.directionsBtnText}>📍 Get Directions</Text>
              </TouchableOpacity>
              <Text style={styles.stockCountText}>{allIngredients.length} ingredients left in stock</Text>
            </View>

            <View style={styles.ingredientGrid}>
              {allIngredients.map((item) => (
                <IngredientCard
                  key={item.ean}
                  item={item}
                  isSelected={selectedEans.has(item.ean)}
                  onToggle={(toggledItem) => {
                    setSelectedEans(prev => {
                      const next = new Set(prev);
                      next.has(toggledItem.ean) ? next.delete(toggledItem.ean) : next.add(toggledItem.ean);
                      return next;
                    });
                  }}
                />
              ))}
            </View>
          </View>
        )}

        {/* Recipe generation pipeline */}
        {isLoadingRecipe && (
          <View>
            <Text style={styles.pipelineTitle}>Cooking Up Your Recipe…</Text>
            <PipelineProgress stage={stage} steps={RECIPE_STEPS} />
          </View>
        )}

        {/* Done state */}
        {stage === 'done' && (
          <View style={styles.doneCard}>
            <Text style={styles.doneBadge}>✅ RECIPE READY</Text>
            <Text style={styles.doneTitle}>Your panino is waiting!</Text>
            <Text style={styles.doneSubtitle}>
              Tap "View Instructions" below to see the full cooking guide.
            </Text>
          </View>
        )}

        {stage === 'error' && <ErrorState message={error} />}
      </ScrollView>

      {/* ── Footer CTA ── */}
      <View style={styles.footer}>
        {stage === 'ingredients_preview' ? (
          // Ingredient preview: LET'S COOK
          <View style={styles.footerButtons}>
            <TouchableOpacity
              style={[styles.ctaButton, selectedEans.size === 0 && styles.ctaButtonDisabled]}
              onPress={handleLetsCook}
              disabled={selectedEans.size === 0}
              activeOpacity={0.85}>
              <Text style={styles.ctaText}>🍳  LET'S COOK ({selectedEans.size})</Text>
            </TouchableOpacity>
          </View>
        ) : stage === 'error' ? (
          // Error: RETRY
          <View style={styles.footerButtons}>
            <TouchableOpacity
              style={styles.ghostButton}
              onPress={handleRetry}
              activeOpacity={0.7}>
              <Text style={styles.ghostButtonText}>RETRY</Text>
            </TouchableOpacity>
          </View>
        ) : (
          <TouchableOpacity
            style={[styles.ctaButton, isAnyLoading && styles.ctaButtonDisabled]}
            disabled={true}
            activeOpacity={1}>
            {isAnyLoading ? (
              <ActivityIndicator color={BrandColors.primaryContainer} />
            ) : (
              <Text style={styles.ctaText}>PLEASE WAIT…</Text>
            )}
          </TouchableOpacity>
        )}
      </View>
    </SafeAreaView>
  );
}

// ─── Styles ───────────────────────────────────────────────────────────────────
const styles = StyleSheet.create({
  safeArea: { flex: 1, backgroundColor: BrandColors.background },

  // Header
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingLeft: Spacing.md,
    paddingRight: Spacing.xl,
    paddingTop: Spacing.lg,
    paddingBottom: Spacing.md,
  },
  headerLabel: {
    fontFamily: FontFamily.bodyBold,
    fontSize: 10,
    letterSpacing: 2.5,
    color: BrandColors.outlineVariant,
    textTransform: 'uppercase',
  },
  headerTitle: {
    fontFamily: FontFamily.headlineExtraBold,
    fontSize: 34,
    letterSpacing: -1,
    color: BrandColors.onSurface,
    lineHeight: 38,
  },
  headerBadge: {
    width: 48, height: 48, borderRadius: 24,
    backgroundColor: BrandColors.surfaceLowest,
    alignItems: 'center', justifyContent: 'center',
    shadowColor: BrandColors.onSurface, shadowOpacity: 0.06, shadowRadius: 24,
    shadowOffset: { width: 0, height: 4 },
  },
  headerBadgeText: { fontSize: 22 },

  // Scroll
  scroll: { flex: 1 },
  scrollContent: {
    paddingHorizontal: Spacing.lg,
    paddingBottom: Spacing.xl,
    flexGrow: 1,
  },

  // Pipeline
  pipelineTitle: {
    fontFamily: FontFamily.headlineBold,
    fontSize: 18,
    color: BrandColors.onSurface,
    marginBottom: Spacing.md,
  },
  pipelineCard: {
    backgroundColor: BrandColors.surfaceLowest,
    borderRadius: Radius.xl,
    padding: Spacing.lg,
    gap: Spacing.sm,
    shadowColor: BrandColors.onSurface, shadowOpacity: 0.06, shadowRadius: 32,
    shadowOffset: { width: 0, height: 8 },
  },
  pipelineRow: {
    flexDirection: 'row', alignItems: 'center',
    paddingVertical: 12, paddingHorizontal: Spacing.md, borderRadius: Radius.md, gap: Spacing.md,
  },
  pipelineRowActive: { backgroundColor: BrandColors.surfaceLow },
  pipelineEmoji: { fontSize: 22, width: 32, textAlign: 'center' as const },
  pipelineLabel: {
    fontFamily: FontFamily.bodyRegular, flex: 1, fontSize: 15, color: BrandColors.outlineVariant,
  },
  pipelineLabelActive: { fontFamily: FontFamily.bodyBold, color: BrandColors.onSurface },
  pipelineLabelDone: { color: BrandColors.outlineVariant, textDecorationLine: 'line-through' as const },
  pipelineStatus: { width: 24, alignItems: 'center' as const },
  checkCircle: {
    width: 24, height: 24, borderRadius: 12, backgroundColor: BrandColors.tertiary,
    alignItems: 'center' as const, justifyContent: 'center' as const,
  },
  checkMark: { fontFamily: FontFamily.bodyBold, color: BrandColors.onPrimary, fontSize: 12 },

  // Store Block (new grid header)
  storeHeaderBlock: {
    backgroundColor: BrandColors.surfaceLowest,
    padding: Spacing.md,
    borderRadius: Radius.lg,
    marginBottom: Spacing.md,
    alignItems: 'center',
    shadowColor: BrandColors.onSurface, shadowOpacity: 0.04, shadowRadius: 10,
    shadowOffset: { width: 0, height: 4 },
  },
  storeHeaderSubtitle: {
    fontFamily: FontFamily.bodyBold, fontSize: 11, letterSpacing: 2,
    color: BrandColors.outlineVariant, textTransform: 'uppercase', marginBottom: 4,
  },
  storeHeaderTitle: {
    fontFamily: FontFamily.headlineExtraBold, fontSize: 24, color: BrandColors.onSurface,
  },
  directionsBtn: {
    backgroundColor: BrandColors.primaryContainer,
    paddingHorizontal: 20, paddingVertical: 10,
    borderRadius: Radius.pill, marginTop: Spacing.sm,
  },
  directionsBtnText: {
    fontFamily: FontFamily.bodyBold, fontSize: 13, color: BrandColors.onPrimaryContainer,
  },
  stockCountText: {
    fontFamily: FontFamily.bodyRegular, fontSize: 13, color: BrandColors.outlineVariant,
    marginTop: Spacing.sm,
  },
  
  // Ingredient cards
  ingredientGrid: {
    flexDirection: 'row', flexWrap: 'wrap', gap: Spacing.sm, marginTop: Spacing.md,
  },

  // Done state
  doneCard: {
    backgroundColor: BrandColors.surfaceLowest, borderRadius: Radius.lg, padding: Spacing.lg,
    alignItems: 'center' as const, gap: Spacing.sm,
    shadowColor: BrandColors.onSurface, shadowOpacity: 0.06, shadowRadius: 16,
    shadowOffset: { width: 0, height: 4 },
  },
  doneBadge: {
    fontFamily: FontFamily.bodyBold, fontSize: 13, color: BrandColors.tertiary, letterSpacing: 1,
  },
  doneTitle: {
    fontFamily: FontFamily.headlineExtraBold, fontSize: 24, color: BrandColors.onSurface, textAlign: 'center' as const,
  },
  doneSubtitle: {
    fontFamily: FontFamily.bodyRegular, fontSize: 15, color: BrandColors.outlineVariant,
    textAlign: 'center' as const, lineHeight: 22,
  },

  // Idle state
  idleContainer: {
    flex: 1, alignItems: 'center' as const, justifyContent: 'center' as const, paddingTop: Spacing.xxl, gap: Spacing.md,
  },
  idleEmoji: { fontSize: 72, marginBottom: Spacing.sm },
  idleTitle: {
    fontFamily: FontFamily.headlineExtraBold, fontSize: 24, letterSpacing: -0.5,
    color: BrandColors.onSurface, textAlign: 'center' as const,
  },
  idleSubtitle: {
    fontFamily: FontFamily.bodyRegular, fontSize: 15, color: BrandColors.outlineVariant,
    textAlign: 'center' as const, lineHeight: 24, paddingHorizontal: Spacing.lg, marginBottom: Spacing.lg,
  },
  idleTagRow: { flexDirection: 'row', gap: Spacing.sm, flexWrap: 'wrap', justifyContent: 'center' as const },
  idleTag: { backgroundColor: BrandColors.surfaceHigh, paddingHorizontal: 16, paddingVertical: 8, borderRadius: Radius.pill },
  idleTagText: { fontFamily: FontFamily.bodyBold, fontSize: 13, color: BrandColors.onSurface },

  // Error
  errorCard: {
    backgroundColor: BrandColors.surfaceLowest, borderRadius: Radius.lg, padding: Spacing.lg,
    alignItems: 'center' as const, gap: Spacing.sm,
  },
  errorEmoji: { fontSize: 42 },
  errorTitle: { fontFamily: FontFamily.headlineBold, fontSize: 18, color: BrandColors.error },
  errorMessage: {
    fontFamily: FontFamily.bodyRegular, fontSize: 15, color: BrandColors.outlineVariant,
    textAlign: 'center' as const, lineHeight: 22,
  },
  errorHint: {
    fontFamily: FontFamily.bodyRegular, fontSize: 13, color: BrandColors.outlineVariant,
    textAlign: 'center' as const, lineHeight: 20, marginTop: Spacing.xs,
  },

  // Footer
  footer: {
    paddingHorizontal: Spacing.lg, paddingBottom: Spacing.xl, paddingTop: Spacing.md,
    backgroundColor: BrandColors.background,
  },
  footerButtons: { gap: Spacing.sm },
  footerRow: { flexDirection: 'row', gap: Spacing.sm },
  ctaButton: {
    backgroundColor: BrandColors.primaryContainer, height: 64, borderRadius: Radius.pill,
    alignItems: 'center' as const, justifyContent: 'center' as const,
    shadowColor: BrandColors.primaryContainer, shadowOpacity: 0.4, shadowRadius: 16,
    shadowOffset: { width: 0, height: 6 },
  },
  ctaButtonDisabled: { opacity: 0.5, shadowOpacity: 0 },
  ctaText: {
    fontFamily: FontFamily.bodyBold, fontSize: 15, color: BrandColors.onPrimaryContainer,
    letterSpacing: 2, textTransform: 'uppercase' as const,
  },
  ghostButton: {
    height: 52, borderRadius: Radius.pill, alignItems: 'center' as const, justifyContent: 'center' as const,
    borderWidth: 2, borderColor: BrandColors.surfaceHighest, backgroundColor: 'transparent',
  },
  ghostButtonText: {
    fontFamily: FontFamily.bodyBold, fontSize: 14, color: BrandColors.outlineVariant,
    letterSpacing: 2, textTransform: 'uppercase' as const,
  },
  ctaButtonSecondary: {
    height: 64, borderRadius: Radius.pill, alignItems: 'center' as const, justifyContent: 'center' as const,
    borderWidth: 2, borderColor: BrandColors.surfaceHighest, backgroundColor: 'transparent',
  },
  ctaTextSecondary: {
    fontFamily: FontFamily.bodyBold, fontSize: 15, color: BrandColors.outlineVariant,
    letterSpacing: 2, textTransform: 'uppercase' as const,
  },
  completeButton: {
    height: 52, borderRadius: Radius.pill, alignItems: 'center' as const, justifyContent: 'center' as const,
    backgroundColor: BrandColors.onSurface, marginTop: Spacing.sm,
  },
  completeButtonText: {
    fontFamily: FontFamily.bodyBold, fontSize: 14, color: BrandColors.primaryContainer,
    letterSpacing: 1.5, textTransform: 'uppercase' as const,
  },

  // Checking / Off-day states
  checkingContainer: {
    flex: 1, alignItems: 'center' as const, justifyContent: 'center' as const, paddingTop: Spacing.xxl, gap: Spacing.md,
  },
  checkingText: { fontFamily: FontFamily.bodyRegular, fontSize: 15, color: BrandColors.outlineVariant },
  offDayContainer: {
    flex: 1, alignItems: 'center' as const, justifyContent: 'center' as const, paddingTop: Spacing.xxl, gap: Spacing.md,
  },
  offDayEmoji: { fontSize: 72, marginBottom: Spacing.sm },
  offDayTitle: {
    fontFamily: FontFamily.headlineExtraBold, fontSize: 24, letterSpacing: -0.5,
    color: BrandColors.onSurface, textAlign: 'center' as const,
  },
  offDaySubtitle: {
    fontFamily: FontFamily.bodyRegular, fontSize: 15, color: BrandColors.outlineVariant,
    textAlign: 'center' as const, lineHeight: 24, paddingHorizontal: Spacing.lg,
  },
});
