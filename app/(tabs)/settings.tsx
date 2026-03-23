/**
 * Settings — Configure store preferences.
 */
import React, { useState, useEffect, useRef } from 'react';
import {
  View,
  Text,
  ScrollView,
  StyleSheet,
  TouchableOpacity,
  StatusBar,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { BrandColors, Spacing, Radius, FontFamily } from '@/constants/theme';
import { supabase } from '@/lib/supabase';
import { updateSettings } from '@/lib/db';

const STORES = ['Engelsborgvej', 'Jernbanepladsen', 'Both'];

function SectionHeader({ title }: { title: string }) {
  return <Text style={styles.sectionHeader}>{title}</Text>;
}

export default function SettingsScreen() {
  const [selectedStore, setSelectedStore] = useState('Both');
  const initialized = useRef(false);

  // ── Load settings from Supabase on mount ──────────────────────────────────
  useEffect(() => {
    supabase
      .from('settings')
      .select('preferred_store')
      .eq('id', 1)
      .single()
      .then(({ data, error }) => {
        if (error || !data) return;
        setSelectedStore(data.preferred_store || 'Both');
        initialized.current = true;
      });
  }, []);

  // ── Auto-save whenever settings change (only after confirmed load) ─────────
  useEffect(() => {
    if (!initialized.current) return;
    updateSettings({
      preferred_store: selectedStore,
    }).catch(console.error);
  }, [selectedStore]);

  return (
    <SafeAreaView style={styles.safeArea}>
      <StatusBar barStyle="dark-content" backgroundColor={BrandColors.background} />

      {/* Header */}
      <View style={styles.header}>
        <Text style={styles.headerLabel}>SETTINGS</Text>
        <Text style={styles.headerTitle}>Preferences</Text>
      </View>

      <ScrollView
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}>

        {/* Store preferences */}
        <SectionHeader title="STORE PREFERENCE" />
        <View style={styles.card}>
          {STORES.map((store, idx) => (
            <React.Fragment key={store}>
              <TouchableOpacity
                style={styles.storeRow}
                onPress={() => setSelectedStore(store)}
                activeOpacity={0.7}>
                <Text style={[
                  styles.storeLabel,
                  selectedStore === store && styles.storeLabelActive,
                ]}>
                  {store}
                </Text>
                {selectedStore === store && (
                  <View style={styles.selectedDot} />
                )}
              </TouchableOpacity>
              {idx < STORES.length - 1 && <View style={styles.innerDivider} />}
            </React.Fragment>
          ))}
        </View>

      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: { flex: 1, backgroundColor: BrandColors.background },
  header: {
    paddingHorizontal: Spacing.md,
    paddingTop: Spacing.xl,
    paddingBottom: Spacing.md,
  },
  headerLabel: {
    fontFamily: FontFamily.bodyBold,
    fontSize: 11,
    letterSpacing: 2,
    color: BrandColors.outlineVariant,
    textTransform: 'uppercase',
  },
  headerTitle: {
    fontFamily: FontFamily.headlineExtraBold,
    fontSize: 28,
    color: BrandColors.onSurface,
    marginTop: 4,
  },
  scrollContent: {
    paddingHorizontal: Spacing.md,
    paddingBottom: Spacing.xxl,
  },
  sectionHeader: {
    fontFamily: FontFamily.bodyBold,
    fontSize: 11,
    letterSpacing: 1.5,
    color: BrandColors.outlineVariant,
    marginTop: Spacing.lg,
    marginBottom: Spacing.sm,
    textTransform: 'uppercase',
  },
  card: {
    backgroundColor: BrandColors.surfaceLowest,
    borderRadius: Radius.lg,
    overflow: 'hidden',
    shadowColor: BrandColors.onSurface,
    shadowOpacity: 0.04,
    shadowRadius: 8,
    shadowOffset: { width: 0, height: 2 },
    elevation: 2,
  },
  innerDivider: {
    height: StyleSheet.hairlineWidth,
    backgroundColor: BrandColors.surfaceHigh,
    marginLeft: Spacing.md,
  },
  storeRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: Spacing.md,
  },
  storeLabel: {
    fontFamily: FontFamily.bodyRegular,
    fontSize: 15,
    color: BrandColors.onSurface,
  },
  storeLabelActive: {
    fontFamily: FontFamily.bodyBold,
    color: BrandColors.primaryContainer,
  },
  selectedDot: {
    width: 10,
    height: 10,
    borderRadius: 5,
    backgroundColor: BrandColors.primaryContainer,
  },
});
