import React, { useState, useCallback } from 'react';
import {
  View,
  Text,
  ScrollView,
  StyleSheet,
  TouchableOpacity,
  StatusBar,
  Alert,
  ActivityIndicator,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Image } from 'expo-image';
import { useFocusEffect } from 'expo-router';
import { BrandColors, Spacing, Radius, FontFamily } from '@/constants/theme';
import {
  getVaultRecipes,
  setFavorite,
  deleteRecipe,
  type VaultRecipe,
} from '@/lib/db';

function RecipeCard({
  recipe,
  onFavoriteToggle,
  onDelete,
}: {
  recipe: VaultRecipe;
  onFavoriteToggle: (id: string, current: boolean) => void;
  onDelete: (recipe: VaultRecipe) => void;
}) {
  const [photoExpanded, setPhotoExpanded] = useState(false);

  const dateLabel = new Date(recipe.created_at).toLocaleDateString('en-GB', {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
  });

  const confirmDelete = () => {
    Alert.alert(
      'Delete recipe?',
      `"${recipe.panino_name}" will be permanently removed from your vault.`,
      [
        { text: 'Cancel', style: 'cancel' },
        { text: 'Delete', style: 'destructive', onPress: () => onDelete(recipe) },
      ],
    );
  };

  return (
    <View style={styles.card}>
      {/* Photo header — tappable to expand/collapse */}
      {recipe.photo_url && (
        <TouchableOpacity
          activeOpacity={0.9}
          onPress={() => setPhotoExpanded(e => !e)}>
          <Image
            source={{ uri: recipe.photo_url }}
            style={[styles.cardPhoto, photoExpanded && styles.cardPhotoExpanded]}
            contentFit="cover"
            transition={200}
          />
        </TouchableOpacity>
      )}

      <View style={styles.cardBody}>
        {/* Title row */}
        <View style={styles.cardTitleRow}>
          <Text style={styles.cardTitle} numberOfLines={2}>
            {recipe.panino_name}
          </Text>
          <TouchableOpacity
            onPress={() => onFavoriteToggle(recipe.id, recipe.is_favorite)}
            hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}>
            <Text style={styles.favIcon}>{recipe.is_favorite ? '★' : '☆'}</Text>
          </TouchableOpacity>
        </View>

        {/* Meta */}
        <View style={styles.metaRow}>
          <View style={styles.storeBadge}>
            <Text style={styles.storeBadgeText}>{recipe.store}</Text>
          </View>
          <Text style={styles.dateText}>{dateLabel}</Text>
        </View>

        {/* Ingredients */}
        <Text style={styles.sectionLabel}>INGREDIENTS</Text>
        <Text style={styles.ingredientsText}>{recipe.ingredients.join(' · ')}</Text>

        {/* Money saved */}
        {recipe.total_savings != null && recipe.total_savings > 0 && (
          <View style={styles.savingsRow}>
            <Text style={styles.savingsLabel}>YOU SAVED</Text>
            <Text style={styles.savingsAmount}>{recipe.total_savings.toFixed(2)} kr</Text>
          </View>
        )}

        {/* Actions */}
        <View style={styles.actionsRow}>
          {!recipe.photo_url && (
            <Text style={styles.noPhotoNote}>No photo</Text>
          )}
          <TouchableOpacity style={styles.deleteButton} onPress={confirmDelete}>
            <Text style={styles.deleteText}>Remove</Text>
          </TouchableOpacity>
        </View>
      </View>
    </View>
  );
}

export default function VaultScreen() {
  const [recipes, setRecipes] = useState<VaultRecipe[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);
      const data = await getVaultRecipes();
      setRecipes(data);
    } catch {
      setError('Could not load vault. Check your Supabase connection.');
    } finally {
      setLoading(false);
    }
  }, []);

  useFocusEffect(useCallback(() => { load(); }, [load]));

  const handleFavoriteToggle = async (id: string, current: boolean) => {
    setRecipes(prev =>
      prev.map(r => (r.id === id ? { ...r, is_favorite: !current } : r)),
    );
    try {
      await setFavorite(id, !current);
    } catch {
      setRecipes(prev =>
        prev.map(r => (r.id === id ? { ...r, is_favorite: current } : r)),
      );
    }
  };

  const handleDelete = async (recipe: VaultRecipe) => {
    setRecipes(prev => prev.filter(r => r.id !== recipe.id));
    try {
      await deleteRecipe(recipe);
    } catch {
      setRecipes(prev => [recipe, ...prev]);
      Alert.alert('Error', 'Could not delete recipe. Please try again.');
    }
  };

  const totalCount = recipes.length;
  const favCount = recipes.filter(r => r.is_favorite).length;
  const withPhotoCount = recipes.filter(r => r.photo_url).length;

  return (
    <SafeAreaView style={styles.safeArea}>
      <StatusBar barStyle="dark-content" backgroundColor={BrandColors.background} />

      {/* Header */}
      <View style={styles.header}>
        <Text style={styles.headerLabel}>THE PANINO</Text>
        <Text style={styles.headerTitle}>History</Text>
      </View>

      {/* Stats Row */}
      <View style={styles.statsRow}>
        <View style={styles.statCard}>
          <Text style={styles.statNumber}>{totalCount}</Text>
          <Text style={styles.statLabel}>TOTAL</Text>
        </View>
        <View style={styles.statDivider} />
        <View style={styles.statCard}>
          <Text style={styles.statNumber}>{favCount}</Text>
          <Text style={styles.statLabel}>FAVOURITES</Text>
        </View>
        <View style={styles.statDivider} />
        <View style={styles.statCard}>
          <Text style={styles.statNumber}>{withPhotoCount}</Text>
          <Text style={styles.statLabel}>WITH PHOTO</Text>
        </View>
      </View>

      {loading ? (
        <View style={styles.centered}>
          <ActivityIndicator color={BrandColors.primaryContainer} size="large" />
        </View>
      ) : error ? (
        <View style={styles.centered}>
          <Text style={styles.errorEmoji}>⚠️</Text>
          <Text style={styles.errorText}>{error}</Text>
          <TouchableOpacity style={styles.retryButton} onPress={load}>
            <Text style={styles.retryText}>Retry</Text>
          </TouchableOpacity>
        </View>
      ) : (
        <ScrollView
          contentContainerStyle={styles.scrollContent}
          showsVerticalScrollIndicator={false}>
          {recipes.length === 0 ? (
            <View style={styles.emptyState}>
              <Text style={styles.emptyEmoji}>🥪</Text>
              <Text style={styles.emptyTitle}>History is empty</Text>
              <Text style={styles.emptySubtitle}>
                Make your first panino on the Today tab, then capture it to save it here.
              </Text>
            </View>
          ) : (
            recipes.map(recipe => (
              <RecipeCard
                key={recipe.id}
                recipe={recipe}
                onFavoriteToggle={handleFavoriteToggle}
                onDelete={handleDelete}
              />
            ))
          )}
        </ScrollView>
      )}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: BrandColors.background,
  },
  header: {
    paddingHorizontal: Spacing.md,
    paddingTop: Spacing.md,
    paddingBottom: Spacing.sm,
  },
  headerLabel: {
    fontSize: 11,
    letterSpacing: 2,
    color: BrandColors.outlineVariant,
    fontWeight: '600',
  },
  headerTitle: {
    fontFamily: FontFamily.headlineExtraBold,
    fontSize: 34,
    fontWeight: '800',
    color: BrandColors.onSurface,
    lineHeight: 38,
  },
  statsRow: {
    flexDirection: 'row',
    marginHorizontal: Spacing.md,
    marginBottom: Spacing.md,
    backgroundColor: BrandColors.surfaceLowest,
    borderRadius: Radius.lg,
    paddingVertical: Spacing.md,
    elevation: 2,
    shadowColor: BrandColors.onSurface,
    shadowOpacity: 0.06,
    shadowRadius: 8,
    shadowOffset: { width: 0, height: 2 },
  },
  statCard: {
    flex: 1,
    alignItems: 'center',
  },
  statNumber: {
    fontFamily: FontFamily.headlineExtraBold,
    fontSize: 26,
    fontWeight: '800',
    color: BrandColors.onSurface,
  },
  statLabel: {
    fontSize: 10,
    letterSpacing: 1.5,
    color: BrandColors.outlineVariant,
    fontWeight: '600',
    marginTop: 2,
  },
  statDivider: {
    width: StyleSheet.hairlineWidth,
    backgroundColor: BrandColors.surfaceHigh,
    marginVertical: Spacing.xs,
  },
  scrollContent: {
    paddingHorizontal: Spacing.md,
    paddingBottom: Spacing.xl,
    gap: Spacing.md,
  },

  // Card
  card: {
    backgroundColor: BrandColors.surfaceLowest,
    borderRadius: Radius.lg,
    overflow: 'hidden',
    elevation: 3,
    shadowColor: BrandColors.onSurface,
    shadowOpacity: 0.08,
    shadowRadius: 12,
    shadowOffset: { width: 0, height: 3 },
  },
  cardPhoto: {
    width: '100%',
    height: 200,
  },
  cardPhotoExpanded: {
    height: 320,
  },
  cardBody: {
    padding: Spacing.md,
    gap: Spacing.xs,
  },
  cardTitleRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    justifyContent: 'space-between',
    gap: Spacing.sm,
  },
  cardTitle: {
    fontFamily: FontFamily.headlineBold,
    fontSize: 20,
    fontWeight: '700',
    color: BrandColors.onSurface,
    flex: 1,
    lineHeight: 26,
  },
  favIcon: {
    fontSize: 24,
    color: BrandColors.primaryContainer,
    marginTop: 1,
  },
  metaRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.sm,
    marginBottom: Spacing.xs,
  },
  storeBadge: {
    backgroundColor: BrandColors.tertiary,
    paddingHorizontal: 10,
    paddingVertical: 3,
    borderRadius: Radius.sm,
  },
  storeBadgeText: {
    color: BrandColors.surfaceLowest,
    fontSize: 11,
    fontWeight: '700',
  },
  dateText: {
    fontSize: 13,
    color: BrandColors.outlineVariant,
  },
  sectionLabel: {
    fontSize: 10,
    letterSpacing: 1.5,
    color: BrandColors.outlineVariant,
    fontWeight: '600',
    marginBottom: 2,
  },
  ingredientsText: {
    fontFamily: FontFamily.bodyRegular,
    fontSize: 14,
    color: BrandColors.onSurface,
    lineHeight: 21,
  },
  savingsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.sm,
    marginTop: Spacing.xs,
    backgroundColor: BrandColors.surfaceHigh,
    borderRadius: Radius.sm,
    paddingHorizontal: Spacing.sm,
    paddingVertical: Spacing.xs,
    alignSelf: 'flex-start',
  },
  savingsLabel: {
    fontSize: 10,
    letterSpacing: 1.5,
    color: BrandColors.outlineVariant,
    fontWeight: '600',
  },
  savingsAmount: {
    fontFamily: FontFamily.headlineBold,
    fontSize: 15,
    fontWeight: '700',
    color: BrandColors.primaryContainer,
  },
  actionsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginTop: Spacing.sm,
  },
  noPhotoNote: {
    fontSize: 12,
    color: BrandColors.outlineVariant,
  },
  deleteButton: {
    alignSelf: 'flex-end',
    paddingHorizontal: Spacing.xs,
    paddingVertical: 4,
  },
  deleteText: {
    fontSize: 13,
    color: BrandColors.error,
    fontWeight: '600',
  },

  // Loading / error / empty
  centered: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    gap: Spacing.sm,
    paddingBottom: Spacing.xxl,
  },
  errorEmoji: {
    fontSize: 36,
  },
  errorText: {
    fontSize: 14,
    color: BrandColors.outlineVariant,
    textAlign: 'center',
    paddingHorizontal: Spacing.xl,
  },
  retryButton: {
    backgroundColor: BrandColors.primaryContainer,
    paddingHorizontal: Spacing.lg,
    paddingVertical: Spacing.sm,
    borderRadius: Radius.pill,
    marginTop: Spacing.sm,
  },
  retryText: {
    fontWeight: '700',
    color: BrandColors.onSurface,
  },
  emptyState: {
    alignItems: 'center',
    paddingTop: Spacing.xxl,
    gap: Spacing.sm,
  },
  emptyEmoji: {
    fontSize: 56,
  },
  emptyTitle: {
    fontFamily: FontFamily.headlineBold,
    fontSize: 20,
    fontWeight: '700',
    color: BrandColors.onSurface,
  },
  emptySubtitle: {
    fontFamily: FontFamily.bodyRegular,
    fontSize: 15,
    color: BrandColors.outlineVariant,
    textAlign: 'center',
    lineHeight: 22,
    paddingHorizontal: Spacing.xl,
  },
});
