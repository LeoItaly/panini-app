import React from 'react';
import { View, Text, StyleSheet, TouchableOpacity, Dimensions } from 'react-native';
import { Image } from 'expo-image';
import { BrandColors, Spacing, Radius, FontFamily } from '@/constants/theme';
import { PaninoIngredient } from '@/hooks/RecipeContext';

const { width: SCREEN_WIDTH } = Dimensions.get('window');

interface Props {
  item: PaninoIngredient;
  isSelected?: boolean;
  onToggle?: (item: PaninoIngredient) => void;
  width?: number; // optional override
}

export function IngredientCard({ item, isSelected = false, onToggle, width }: Props) {
  const cardWidth = width || (SCREEN_WIDTH - Spacing.lg * 2 - Spacing.sm) / 2;

  const handlePress = () => {
    if (onToggle) onToggle(item);
  };

  return (
    <TouchableOpacity
      activeOpacity={onToggle ? 0.8 : 1}
      onPress={onToggle ? handlePress : undefined}
      style={[
        styles.ingredientCard,
        { width: cardWidth },
        isSelected && styles.ingredientCardSelected,
      ]}>
      {/* Selected Overlay */}
      {isSelected && (
        <View style={styles.selectedOverlay}>
          <Text style={styles.selectedCheck}>✓</Text>
        </View>
      )}

      {item.productImage ? (
        <Image
          source={{ uri: item.productImage }}
          style={styles.ingredientImage}
          contentFit="cover"
          transition={200}
        />
      ) : (
        <View style={[styles.ingredientImage, styles.ingredientImagePlaceholder]}>
          <Text style={{ fontSize: 32 }}>🥪</Text>
        </View>
      )}
      <View style={styles.ingredientCardBody}>
        <View style={styles.discountBadge}>
          <Text style={styles.discountBadgeText}>-{Math.round(item.percentDiscount)}%</Text>
        </View>
        <Text style={styles.ingredientName} numberOfLines={2}>
          {item.productNameEn || item.productName}
        </Text>
        <Text style={styles.ingredientCategory}>{item.categoryEn}</Text>
        <View style={styles.priceRow}>
          <Text style={styles.priceNew}>{item.newPrice.toFixed(2)} kr</Text>
          <Text style={styles.priceOriginal}>{item.originalPrice.toFixed(2)}</Text>
        </View>
        {item.stock <= 2 && item.stock > 0 && (
          <Text style={styles.stockWarning}>Only {item.stock} left</Text>
        )}
        {item.stock === 0 && (
          <Text style={styles.stockOut}>Out of stock</Text>
        )}
      </View>
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  ingredientCard: {
    backgroundColor: BrandColors.surfaceLowest,
    borderRadius: Radius.lg,
    overflow: 'hidden',
    marginBottom: Spacing.sm,
    borderWidth: 2,
    borderColor: 'transparent',
    // Shadow
    elevation: 3,
    shadowColor: BrandColors.onSurface,
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 6,
  },
  ingredientCardSelected: {
    borderColor: BrandColors.primaryContainer,
  },
  selectedOverlay: {
    position: 'absolute',
    top: Spacing.xs,
    right: Spacing.xs,
    zIndex: 10,
    backgroundColor: BrandColors.primaryContainer,
    width: 24,
    height: 24,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
  },
  selectedCheck: {
    color: BrandColors.onSurface,
    fontSize: 14,
    fontWeight: '900',
  },
  ingredientImage: {
    width: '100%',
    height: 100,
    backgroundColor: BrandColors.surfaceHigh,
  },
  ingredientImagePlaceholder: {
    alignItems: 'center',
    justifyContent: 'center',
  },
  ingredientCardBody: {
    padding: Spacing.sm,
    gap: 4,
  },
  discountBadge: {
    position: 'absolute',
    top: -12,
    right: 8,
    backgroundColor: BrandColors.primaryContainer,
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: Radius.sm,
  },
  discountBadgeText: {
    fontFamily: FontFamily.bodyBold,
    fontSize: 12,
    color: BrandColors.onSurface,
  },
  ingredientName: {
    fontFamily: FontFamily.bodyBold,
    fontSize: 14,
    color: BrandColors.onSurface,
    lineHeight: 18,
    marginTop: 4,
  },
  ingredientCategory: {
    fontFamily: FontFamily.bodyRegular,
    fontSize: 12,
    color: BrandColors.outlineVariant,
  },
  priceRow: {
    flexDirection: 'row',
    alignItems: 'baseline',
    gap: 6,
    marginTop: 2,
  },
  priceNew: {
    fontFamily: FontFamily.headlineBold,
    fontSize: 16,
    color: BrandColors.onSurface,
  },
  priceOriginal: {
    fontFamily: FontFamily.bodyRegular,
    fontSize: 12,
    color: BrandColors.outlineVariant,
    textDecorationLine: 'line-through',
  },
  stockWarning: {
    fontFamily: FontFamily.bodyBold,
    fontSize: 11,
    color: BrandColors.error,
    marginTop: 2,
  },
  stockOut: {
    fontFamily: FontFamily.bodyBold,
    fontSize: 11,
    color: BrandColors.outlineVariant,
    marginTop: 2,
  },
});
