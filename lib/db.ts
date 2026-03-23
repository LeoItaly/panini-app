/**
 * Database helpers — all Supabase reads/writes go through here.
 * Screens import from this file, never from supabase.ts directly.
 */
import { supabase, PHOTOS_BUCKET } from './supabase';

// ─── Types ────────────────────────────────────────────────────────────────────

export interface Settings {
  preferred_store: string;
}

export interface VaultRecipe {
  id: string;
  panino_name: string;
  store: string;
  ingredients: string[];
  prep: string;
  photo_url: string | null;
  is_favorite: boolean;
  created_at: string;
  total_savings: number | null;
}

export interface NewVaultRecipe {
  panino_name: string;
  store: string;
  ingredients: string[];
  prep: string;
  photo_url?: string | null;
  total_savings?: number | null;
}

// ─── Settings ─────────────────────────────────────────────────────────────────

/**
 * Load app settings. Returns defaults if the row doesn't exist yet.
 */
export async function getSettings(): Promise<Settings> {
  const { data, error } = await supabase
    .from('settings')
    .select('preferred_store')
    .eq('id', 1)
    .single();

  if (error || !data) {
    // Table may not exist yet — return safe defaults so the app doesn't crash
    if (error) console.warn('getSettings:', error.message);
    return {
      preferred_store: 'Both',
    };
  }
  return data as Settings;
}

/**
 * Persist any subset of settings fields.
 */
export async function updateSettings(updates: Partial<Settings>): Promise<void> {
  const { error } = await supabase
    .from('settings')
    .update({ ...updates, updated_at: new Date().toISOString() })
    .eq('id', 1);

  if (error) throw new Error(error.message);
}

// ─── Vault ────────────────────────────────────────────────────────────────────

/**
 * Return all saved recipes, newest first.
 */
export async function getVaultRecipes(): Promise<VaultRecipe[]> {
  const { data, error } = await supabase
    .from('vault')
    .select('*')
    .order('created_at', { ascending: false });

  if (error) throw new Error(error.message);
  return (data ?? []) as VaultRecipe[];
}

/**
 * Save a new recipe to the vault. Returns the saved row.
 */
export async function saveRecipeToVault(recipe: NewVaultRecipe): Promise<VaultRecipe> {
  const { data, error } = await supabase
    .from('vault')
    .insert(recipe)
    .select()
    .single();

  if (error) throw new Error(error.message);
  return data as VaultRecipe;
}

/**
 * Toggle the favourite flag on a vault entry.
 */
export async function setFavorite(id: string, isFavorite: boolean): Promise<void> {
  const { error } = await supabase
    .from('vault')
    .update({ is_favorite: isFavorite })
    .eq('id', id);

  if (error) throw new Error(error.message);
}

/**
 * Permanently delete a recipe (and its photo if one exists).
 */
export async function deleteRecipe(recipe: VaultRecipe): Promise<void> {
  // Remove photo from storage first if present
  if (recipe.photo_url) {
    const path = recipe.photo_url.split(`/${PHOTOS_BUCKET}/`)[1];
    if (path) {
      await supabase.storage.from(PHOTOS_BUCKET).remove([path]);
    }
  }

  const { error } = await supabase.from('vault').delete().eq('id', recipe.id);
  if (error) throw new Error(error.message);
}

// ─── Photo Storage ────────────────────────────────────────────────────────────

/**
 * Upload a photo from a local URI and return its public URL.
 * Requires expo-camera or expo-image-picker to provide the file URI.
 *
 * @param localUri  - The local file:// URI from the camera/picker
 * @returns         - Public HTTPS URL stored in Supabase Storage, or null on failure
 */
export async function uploadPaninoPhoto(localUri: string): Promise<string | null> {
  try {
    const response = await fetch(localUri);
    const arrayBuffer = await response.arrayBuffer();

    const fileName = `panino_${Date.now()}.jpg`;

    const { data, error } = await supabase.storage
      .from(PHOTOS_BUCKET)
      .upload(fileName, arrayBuffer, { contentType: 'image/jpeg', upsert: false });

    if (error) throw error;

    const { data: urlData } = supabase.storage
      .from(PHOTOS_BUCKET)
      .getPublicUrl(data.path);

    return urlData.publicUrl;
  } catch (err) {
    console.error('Photo upload failed:', err);
    return null;
  }
}
