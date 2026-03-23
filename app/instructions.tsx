import React, { useState } from 'react';
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
import { router } from 'expo-router';
import * as ImagePicker from 'expo-image-picker';
import { BrandColors, Spacing, Radius, FontFamily } from '@/constants/theme';
import { useRecipe } from '@/hooks/RecipeContext';
import { IngredientCard } from '@/components/IngredientCard';
import { uploadPaninoPhoto, saveRecipeToVault } from '@/lib/db';

export default function InstructionsScreen() {
  const { activeRecipe } = useRecipe();
  const [isUploading, setIsUploading] = useState(false);

  // ── No recipe — shouldn't happen but handle gracefully ──
  if (!activeRecipe) {
    return (
      <SafeAreaView style={styles.safeArea}>
        <StatusBar barStyle="dark-content" backgroundColor={BrandColors.background} />
        <View style={styles.emptyState}>
          <Text style={styles.emptyEmoji}>📖</Text>
          <Text style={styles.emptyTitle}>No recipe yet</Text>
          <Text style={styles.emptySubtitle}>
            Generate a panino on the Today tab first.
          </Text>
          <TouchableOpacity
            style={styles.backButton}
            onPress={() => router.back()}
            activeOpacity={0.85}>
            <Text style={styles.backButtonText}>← GO BACK</Text>
          </TouchableOpacity>
        </View>
      </SafeAreaView>
    );
  }

  const { panino, store, combo, instructions, totalPrice, totalSavings } = activeRecipe;

  const parsedSteps = instructions
    .split('\n')
    .map(s => s.trim())
    .filter(s => s.length > 0)
    .map(s => {
      // Extract leading number if present (e.g., "1. Toast bread" -> num: "1", text: "Toast bread")
      const match = s.match(/^(\d+)[\.\)]?\s*(.*)/);
      if (match) {
        return { num: match[1], text: match[2] };
      }
      return { num: '•', text: s };
    });

  const handleCapture = async () => {
    const { status } = await ImagePicker.requestCameraPermissionsAsync();
    if (status !== 'granted') {
      Alert.alert('Permission Denied', 'We need camera permission to take a picture of your panino.');
      return;
    }

    const result = await ImagePicker.launchCameraAsync({
      mediaTypes: ['images'],
      allowsEditing: true,
      aspect: [4, 3],
      quality: 0.8,
    });

    if (!result.canceled && result.assets && result.assets.length > 0) {
      setIsUploading(true);
      try {
        const photoUrl = await uploadPaninoPhoto(result.assets[0].uri);
        
        await saveRecipeToVault({
          panino_name: panino,
          store,
          ingredients: combo.map((i) => i.productNameEn || i.productName),
          prep: instructions,
          photo_url: photoUrl,
          total_savings: totalSavings,
        });

        Alert.alert('Success!', 'Your panino has been saved to the Vault.', [
          { text: 'View Vault', onPress: () => router.navigate('/(tabs)/vault') },
          { text: 'Done', style: 'cancel' }
        ]);
      } catch (err) {
        Alert.alert('Error', 'Failed to save recipe to vault.');
      } finally {
        setIsUploading(false);
      }
    }
  };

  return (
    <SafeAreaView style={styles.safeArea}>
      <StatusBar barStyle="dark-content" backgroundColor={BrandColors.background} />

      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()} hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}>
          <Text style={styles.headerBack}>← Back</Text>
        </TouchableOpacity>
        <Text style={styles.headerLabel}>INSTRUCTIONS</Text>
      </View>

      <ScrollView
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}>

        {/* Recipe name card */}
        <View style={styles.recipeNameCard}>
          <View style={styles.storeBadge}>
            <Text style={styles.storeBadgeText}>{store}</Text>
          </View>
          <Text style={styles.recipeName}>{panino}</Text>
          <View style={styles.pricingRow}>
            <Text style={styles.pricingTotal}>{totalPrice.toFixed(2)} kr</Text>
            <Text style={styles.pricingSaved}>saving {totalSavings.toFixed(2)} kr</Text>
          </View>
        </View>

        {/* Selected Ingredients visual grid */}
        <Text style={styles.sectionLabel}>INGREDIENTS NEEDED</Text>
        <View style={styles.ingredientGrid}>
          {combo.map((item) => (
            <IngredientCard key={item.ean} item={item} />
          ))}
        </View>

        {/* Full instructions */}
        <Text style={styles.sectionLabel}>STEP-BY-STEP GUIDE</Text>
        <View style={styles.stepsContainer}>
          {parsedSteps.map((step, idx) => (
            <View key={idx} style={styles.stepCard}>
              <View style={styles.stepNumberBadge}>
                <Text style={styles.stepNumberText}>{step.num}</Text>
              </View>
              <Text style={styles.stepText}>{step.text}</Text>
            </View>
          ))}
        </View>
      </ScrollView>

      {/* Footer CTA */}
      <View style={styles.footer}>
        <TouchableOpacity
          style={[styles.ctaButton, isUploading && styles.ctaButtonDisabled]}
          onPress={handleCapture}
          disabled={isUploading}
          activeOpacity={0.85}>
          {isUploading ? (
            <ActivityIndicator color={BrandColors.primaryContainer} />
          ) : (
            <Text style={styles.ctaText}>📷  I MADE IT — CAPTURE</Text>
          )}
        </TouchableOpacity>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: { flex: 1, backgroundColor: BrandColors.background },

  // Header
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.md,
    paddingHorizontal: Spacing.md,
    paddingTop: Spacing.md,
    paddingBottom: Spacing.sm,
  },
  headerBack: {
    fontFamily: FontFamily.bodyBold,
    fontSize: 15,
    color: BrandColors.onSurface,
  },
  headerLabel: {
    fontFamily: FontFamily.bodyBold,
    fontSize: 11,
    letterSpacing: 2,
    color: BrandColors.outlineVariant,
    textTransform: 'uppercase',
  },

  // Empty state
  emptyState: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: Spacing.xl,
    gap: Spacing.sm,
    paddingBottom: Spacing.xxl,
  },
  emptyEmoji: { fontSize: 56, marginBottom: Spacing.sm },
  emptyTitle: {
    fontFamily: FontFamily.headlineBold,
    fontSize: 22,
    color: BrandColors.onSurface,
    textAlign: 'center',
  },
  emptySubtitle: {
    fontFamily: FontFamily.bodyRegular,
    fontSize: 15,
    color: BrandColors.outlineVariant,
    textAlign: 'center',
    lineHeight: 24,
  },
  backButton: {
    marginTop: Spacing.md,
    paddingHorizontal: Spacing.lg,
    paddingVertical: Spacing.sm,
    backgroundColor: BrandColors.surfaceHigh,
    borderRadius: Radius.pill,
  },
  backButtonText: {
    fontFamily: FontFamily.bodyBold,
    fontSize: 14,
    color: BrandColors.onSurface,
  },

  // Scroll
  scrollContent: {
    paddingHorizontal: Spacing.md,
    paddingBottom: Spacing.xl,
    gap: Spacing.md,
  },

  // Recipe name card
  recipeNameCard: {
    backgroundColor: BrandColors.onSurface,
    borderRadius: Radius.lg,
    padding: Spacing.md,
    gap: Spacing.xs,
  },
  storeBadge: {
    backgroundColor: BrandColors.primaryContainer,
    paddingHorizontal: 10,
    paddingVertical: 3,
    borderRadius: Radius.sm,
    alignSelf: 'flex-start',
  },
  storeBadgeText: {
    color: BrandColors.onSurface,
    fontSize: 11,
    fontWeight: '700',
  },
  recipeName: {
    fontFamily: FontFamily.headlineExtraBold,
    fontSize: 22,
    fontWeight: '800',
    color: BrandColors.surfaceLowest,
    marginTop: Spacing.xs,
  },
  pricingRow: {
    flexDirection: 'row',
    alignItems: 'baseline',
    gap: Spacing.sm,
    marginTop: Spacing.xs,
  },
  pricingTotal: {
    fontFamily: FontFamily.headlineBold,
    fontSize: 18,
    color: BrandColors.primaryContainer,
  },
  pricingSaved: {
    fontFamily: FontFamily.bodyRegular,
    fontSize: 13,
    color: BrandColors.outlineVariant,
  },

  // Section label
  sectionLabel: {
    fontSize: 11,
    letterSpacing: 1.5,
    color: BrandColors.outlineVariant,
    fontWeight: '600',
    marginTop: Spacing.sm,
  },

  // Ingredient Grid
  ingredientGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: Spacing.sm,
  },

  // Steps UI
  stepsContainer: {
    gap: Spacing.sm,
  },
  stepCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: BrandColors.surfaceLowest,
    borderRadius: Radius.lg,
    padding: Spacing.md,
    elevation: 2,
    shadowColor: BrandColors.onSurface,
    shadowOpacity: 0.04,
    shadowRadius: 8,
    shadowOffset: { width: 0, height: 2 },
  },
  stepNumberBadge: {
    width: 28, height: 28, borderRadius: 14,
    backgroundColor: BrandColors.primaryContainer,
    alignItems: 'center', justifyContent: 'center',
    marginRight: Spacing.md,
  },
  stepNumberText: {
    fontFamily: FontFamily.bodyBold,
    fontSize: 14,
    color: BrandColors.onPrimaryContainer,
  },
  stepText: {
    flex: 1,
    fontFamily: FontFamily.bodyRegular,
    fontSize: 15,
    color: BrandColors.onSurface,
    lineHeight: 22,
  },

  // Footer
  footer: {
    paddingHorizontal: Spacing.md,
    paddingBottom: Spacing.md,
    paddingTop: Spacing.sm,
    backgroundColor: BrandColors.background,
  },
  ctaButton: {
    height: 52,
    borderRadius: Radius.pill,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: BrandColors.onSurface,
  },
  ctaButtonDisabled: {
    opacity: 0.6,
  },
  ctaText: {
    fontFamily: FontFamily.bodyBold,
    fontSize: 14,
    color: BrandColors.primaryContainer,
    letterSpacing: 1.5,
    textTransform: 'uppercase',
  },
});
