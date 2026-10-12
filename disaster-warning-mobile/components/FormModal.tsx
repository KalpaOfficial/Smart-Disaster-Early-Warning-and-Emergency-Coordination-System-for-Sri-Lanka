/**
 * Professional Form Modal Component.
 * Slides up from the bottom with responsive mobile bounds and tactile header.
 */
import React, { useEffect, useRef } from 'react';
import {
  Modal as RNModal,
  View,
  Text,
  TouchableOpacity,
  ScrollView,
  StyleSheet,
  KeyboardAvoidingView,
  Platform,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { Colors, LightColors, BorderRadius, Spacing } from '@/constants/colors';

interface FormModalProps {
  visible: boolean;
  onClose: () => void;
  title: string;
  children: React.ReactNode;
  appearance?: 'dark' | 'light';
  scrollable?: boolean;
  feedbackKey?: number;
}

export function FormModal({
  visible,
  onClose,
  title,
  children,
  appearance = 'dark',
  scrollable = true,
  feedbackKey,
}: FormModalProps) {
  const light = appearance === 'light';
  const scroll = useRef<ScrollView>(null);
  useEffect(() => {
    if (visible && feedbackKey) scroll.current?.scrollTo({ y: 0, animated: true });
  }, [feedbackKey, visible]);
  return (
    <RNModal visible={visible} transparent animationType="slide" onRequestClose={onClose}>
      <KeyboardAvoidingView
        style={styles.overlay}
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
      >
        <TouchableOpacity style={styles.backdrop} activeOpacity={1} onPress={onClose} />
        <View
          style={[
            styles.sheet,
            !scrollable && { height: '88%' },
            light && {
              backgroundColor: LightColors.surface,
              borderColor: LightColors.border,
              shadowOpacity: 0.12,
            },
          ]}
        >
          <View style={[styles.handle, light && { backgroundColor: LightColors.border }]} />
          <View style={styles.header}>
            <Text style={[styles.title, light && { color: LightColors.text }]}>{title}</Text>
            <TouchableOpacity
              onPress={onClose}
              style={styles.closeButton}
              activeOpacity={0.7}
              accessibilityRole="button"
              accessibilityLabel="Close modal"
            >
              <Ionicons name="close" size={18} color={Colors.text.secondary} />
            </TouchableOpacity>
          </View>
          {scrollable ? (
            <ScrollView
              ref={scroll}
              style={styles.content}
              showsVerticalScrollIndicator={false}
              keyboardShouldPersistTaps="handled"
            >
              {children}
              <View style={styles.bottomPadding} />
            </ScrollView>
          ) : (
            <View style={styles.customContent}>{children}</View>
          )}
        </View>
      </KeyboardAvoidingView>
    </RNModal>
  );
}

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    justifyContent: 'flex-end',
    alignItems: 'center',
  },
  backdrop: {
    ...StyleSheet.absoluteFill,
    backgroundColor: Colors.bg.overlay,
  },
  sheet: {
    width: '100%',
    maxWidth: 500,
    backgroundColor: '#0F172A',
    borderTopLeftRadius: BorderRadius.xl,
    borderTopRightRadius: BorderRadius.xl,
    maxHeight: '88%',
    borderWidth: 1,
    borderBottomWidth: 0,
    borderColor: 'rgba(255, 255, 255, 0.12)',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: -6 },
    shadowOpacity: 0.45,
    shadowRadius: 20,
    elevation: 12,
  },
  handle: {
    width: 36,
    height: 4,
    borderRadius: 2,
    backgroundColor: 'rgba(255, 255, 255, 0.20)',
    alignSelf: 'center',
    marginTop: Spacing.sm,
    marginBottom: Spacing.xs,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: Spacing.xl,
    paddingVertical: Spacing.md,
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(255, 255, 255, 0.08)',
  },
  title: {
    fontSize: 20,
    lineHeight: 28,
    flex: 1,
    marginRight: 12,
    fontWeight: '700',
    color: Colors.text.primary,
    letterSpacing: -0.2,
  },
  closeButton: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: 'rgba(255, 255, 255, 0.06)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  content: {
    paddingHorizontal: Spacing.xl,
    paddingTop: Spacing.lg,
  },
  customContent: { flex: 1, minHeight: 0 },
  bottomPadding: {
    height: Spacing.xxxl,
  },
});
