/**
 * Select / Picker component using a sleek bottom-sheet modal.
 * Uses Ionicons vector glyphs, responsive mobile bounds, and tactical dark mode styling.
 */
import React, { useRef, useState } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  Modal,
  FlatList,
  StyleSheet,
  Platform,
  type ViewStyle,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import {
  Colors,
  LightColors,
  BorderRadius,
  FontSize,
  Spacing,
  MobileTypography,
} from '@/constants/colors';

interface SelectOption {
  value: string;
  label: string;
  description?: string;
}

interface SelectProps {
  label?: string;
  placeholder?: string;
  options: readonly SelectOption[] | SelectOption[];
  value: string;
  onValueChange?: (value: string) => void;
  onSelect?: (value: string) => void;
  error?: string;
  containerStyle?: ViewStyle;
  appearance?: 'dark' | 'light';
  disabled?: boolean;
  footerAction?: { label: string; description?: string; onPress: () => void };
}

export function Select({
  label,
  placeholder = 'Select an option',
  options,
  value,
  onValueChange,
  onSelect,
  error,
  containerStyle,
  appearance = 'dark',
  disabled = false,
  footerAction,
}: SelectProps) {
  const [isOpen, setIsOpen] = useState(false);
  const pendingFooterAction = useRef<(() => void) | null>(null);
  const selectedOption = options.find(o => o.value === value);
  const isLight = appearance === 'light';

  return (
    <View style={[styles.container, containerStyle]}>
      {label ? <Text style={[styles.label, isLight && styles.lightLabel]}>{label}</Text> : null}

      <TouchableOpacity
        style={[
          styles.trigger,
          isLight && styles.lightTrigger,
          error && styles.triggerError,
          disabled && styles.disabled,
        ]}
        onPress={() => setIsOpen(true)}
        activeOpacity={0.7}
        disabled={disabled}
        accessibilityRole="button"
        aria-invalid={!!error}
        accessibilityLabel={`${label || placeholder}: ${selectedOption?.label || placeholder}`}
        accessibilityState={{ expanded: isOpen, disabled }}
      >
        <Text
          style={[
            styles.triggerText,
            isLight && styles.lightText,
            !selectedOption && styles.placeholderText,
            !selectedOption && isLight && styles.lightPlaceholder,
          ]}
        >
          {selectedOption?.label || placeholder}
        </Text>
        <Ionicons
          name="chevron-down"
          size={16}
          color={isLight ? LightColors.secondaryText : Colors.text.tertiary}
        />
      </TouchableOpacity>

      {error ? (
        <Text
          accessibilityRole="alert"
          accessibilityLiveRegion="polite"
          style={[styles.errorText, isLight && styles.lightError]}
        >
          {error}
        </Text>
      ) : null}

      <Modal
        visible={isOpen}
        transparent
        animationType="slide"
        onRequestClose={() => setIsOpen(false)}
        onDismiss={() => {
          const action = pendingFooterAction.current;
          pendingFooterAction.current = null;
          action?.();
        }}
      >
        <View style={styles.overlay}>
          <TouchableOpacity
            style={styles.backdrop}
            activeOpacity={1}
            onPress={() => setIsOpen(false)}
          />
          <View style={[styles.sheet, isLight && styles.lightSheet]} accessibilityViewIsModal>
            <View style={[styles.handle, isLight && styles.lightHandle]} />
            <View style={styles.headerRow}>
              <Text style={[styles.sheetTitle, isLight && styles.lightSheetTitle]}>
                {label || 'Select Option'}
              </Text>
              <TouchableOpacity
                onPress={() => setIsOpen(false)}
                style={[styles.closeBtn, isLight && styles.lightClose]}
                activeOpacity={0.7}
                accessibilityRole="button"
                accessibilityLabel="Close options"
              >
                <Ionicons
                  name="close"
                  size={18}
                  color={isLight ? LightColors.secondaryText : Colors.text.secondary}
                />
              </TouchableOpacity>
            </View>
            <FlatList
              data={options as SelectOption[]}
              keyExtractor={item => item.value}
              showsVerticalScrollIndicator={false}
              contentContainerStyle={styles.listContent}
              renderItem={({ item }) => {
                const isSelected = item.value === value;
                return (
                  <TouchableOpacity
                    style={[
                      styles.option,
                      isSelected && styles.optionSelected,
                      isSelected && isLight && styles.lightSelected,
                    ]}
                    onPress={() => {
                      const handler = onSelect || onValueChange;
                      if (handler) handler(item.value);
                      setIsOpen(false);
                    }}
                    activeOpacity={0.7}
                    accessibilityRole="radio"
                    accessibilityState={{ selected: isSelected }}
                  >
                    <View style={styles.optionContent}>
                      <Text
                        style={[
                          styles.optionLabel,
                          isLight && styles.lightText,
                          isSelected && styles.optionLabelSelected,
                          isSelected && isLight && styles.lightSelectedText,
                        ]}
                      >
                        {item.label}
                      </Text>
                      {item.description && (
                        <Text style={[styles.optionDescription, isLight && styles.lightSecondary]}>
                          {item.description}
                        </Text>
                      )}
                    </View>
                    {isSelected && (
                      <Ionicons
                        name="checkmark-circle"
                        size={20}
                        color={isLight ? LightColors.primary : Colors.accent.primary}
                      />
                    )}
                  </TouchableOpacity>
                );
              }}
            />
            {footerAction && (
              <TouchableOpacity
                accessibilityRole="button"
                accessibilityLabel={footerAction.label}
                disabled={disabled}
                style={[styles.footerAction, isLight && styles.lightSelected]}
                onPress={() => {
                  // iOS must dismiss this sheet before presenting another modal.
                  if (Platform.OS === 'ios') pendingFooterAction.current = footerAction.onPress;
                  setIsOpen(false);
                  if (Platform.OS !== 'ios') footerAction.onPress();
                }}
              >
                <Ionicons
                  name="add-circle-outline"
                  size={24}
                  color={isLight ? LightColors.primary : Colors.accent.primary}
                />
                <View style={styles.optionContent}>
                  <Text
                    style={[
                      styles.optionLabelSelected,
                      isLight && styles.lightSelectedText,
                      styles.footerLabel,
                    ]}
                  >
                    {footerAction.label}
                  </Text>
                  {!!footerAction.description && (
                    <Text style={[styles.optionDescription, isLight && styles.lightSecondary]}>
                      {footerAction.description}
                    </Text>
                  )}
                </View>
              </TouchableOpacity>
            )}
          </View>
        </View>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  footerAction: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    marginHorizontal: 16,
    padding: 14,
    minHeight: 56,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: 'rgba(56,189,248,0.3)',
  },
  footerLabel: { ...MobileTypography.label, fontWeight: '700' },
  lightLabel: {
    color: LightColors.text,
    ...MobileTypography.label,
    fontWeight: '600',
    textTransform: 'none',
    letterSpacing: 0,
    marginBottom: 8,
  },
  lightTrigger: {
    minHeight: 54,
    backgroundColor: LightColors.surfaceMuted,
    borderColor: LightColors.border,
    borderWidth: 1,
    borderRadius: 12,
  },
  lightText: { color: LightColors.text, ...MobileTypography.body },
  lightSheetTitle: { color: LightColors.text, fontSize: 20, lineHeight: 28 },
  lightSecondary: { color: LightColors.secondaryText, ...MobileTypography.caption },
  lightPlaceholder: { color: LightColors.mutedText },
  lightError: { color: LightColors.danger, ...MobileTypography.caption },
  lightSheet: {
    backgroundColor: LightColors.surface,
    borderColor: LightColors.border,
    shadowOpacity: 0.1,
  },
  lightHandle: { backgroundColor: LightColors.border },
  lightClose: { backgroundColor: LightColors.surfaceMuted },
  lightSelected: { backgroundColor: LightColors.primarySoft, borderColor: '#BAD3FF' },
  lightSelectedText: { color: LightColors.primary },
  disabled: { opacity: 0.6 },
  container: {
    marginBottom: Spacing.lg,
  },
  label: {
    fontSize: FontSize.xs,
    fontWeight: '700',
    color: Colors.text.secondary,
    marginBottom: Spacing.xs + 2,
    letterSpacing: 0.8,
    textTransform: 'uppercase',
  },
  trigger: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: '#0D1527',
    borderRadius: BorderRadius.md,
    borderWidth: 1.5,
    borderColor: 'rgba(255, 255, 255, 0.09)',
    paddingVertical: Spacing.md,
    paddingHorizontal: Spacing.lg,
  },
  triggerError: {
    borderColor: Colors.danger,
  },
  triggerText: {
    fontSize: FontSize.md,
    color: Colors.text.primary,
    flex: 1,
  },
  placeholderText: {
    color: Colors.input.placeholder,
  },
  errorText: {
    fontSize: FontSize.xs,
    color: Colors.danger,
    marginTop: Spacing.xs,
    marginLeft: Spacing.xs,
  },
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
    paddingTop: Spacing.sm,
    paddingBottom: Spacing.xxxl,
    maxHeight: '75%',
    borderWidth: 1,
    borderBottomWidth: 0,
    borderColor: 'rgba(255, 255, 255, 0.12)',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: -4 },
    shadowOpacity: 0.35,
    shadowRadius: 16,
    elevation: 10,
  },
  handle: {
    width: 36,
    height: 4,
    borderRadius: 2,
    backgroundColor: 'rgba(255, 255, 255, 0.18)',
    alignSelf: 'center',
    marginTop: Spacing.xs,
    marginBottom: Spacing.md,
  },
  headerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: Spacing.xl,
    marginBottom: Spacing.md,
  },
  sheetTitle: {
    flex: 1,
    marginRight: 12,
    fontSize: FontSize.lg,
    fontWeight: '700',
    color: Colors.text.primary,
  },
  closeBtn: {
    width: 30,
    height: 30,
    borderRadius: 15,
    backgroundColor: 'rgba(255, 255, 255, 0.06)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  listContent: {
    paddingHorizontal: Spacing.lg,
    paddingBottom: Spacing.xl,
  },
  option: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: Spacing.md,
    paddingHorizontal: Spacing.lg,
    borderRadius: BorderRadius.md,
    marginBottom: Spacing.xs,
    borderWidth: 1,
    borderColor: 'transparent',
  },
  optionSelected: {
    backgroundColor: 'rgba(56, 189, 248, 0.12)',
    borderColor: 'rgba(56, 189, 248, 0.30)',
  },
  optionContent: {
    flex: 1,
  },
  optionLabel: {
    fontSize: FontSize.md,
    color: Colors.text.primary,
    fontWeight: '500',
  },
  optionLabelSelected: {
    color: Colors.accent.primary,
    fontWeight: '700',
  },
  optionDescription: {
    fontSize: FontSize.xs,
    color: Colors.text.secondary,
    marginTop: 2,
  },
});
