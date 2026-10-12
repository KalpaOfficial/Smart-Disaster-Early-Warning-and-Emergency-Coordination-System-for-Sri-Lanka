import React from 'react';
import { ActivityIndicator, Modal, Pressable, StyleSheet, Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { LightColors, MobileTypography } from '@/constants/colors';

interface Props {
  visible: boolean;
  title: string;
  message: string;
  confirmLabel: string;
  cancelLabel?: string;
  icon?: keyof typeof Ionicons.glyphMap;
  onConfirm: () => void;
  onCancel: () => void;
  busy?: boolean;
  error?: string;
}

/** Shared app confirmation for sign-out and leaving an unsent report. */
export function ConfirmationDialog({
  visible,
  title,
  message,
  confirmLabel,
  cancelLabel = 'Cancel',
  icon = 'alert-circle-outline',
  onConfirm,
  onCancel,
  busy = false,
  error,
}: Props) {
  const cancel = () => {
    if (!busy) onCancel();
  };
  return (
    <Modal
      visible={visible}
      transparent
      animationType="fade"
      onRequestClose={cancel}
      statusBarTranslucent
    >
      <View style={styles.overlay}>
        <Pressable style={StyleSheet.absoluteFill} onPress={cancel} accessible={false} />
        <View style={styles.dialog} accessibilityViewIsModal>
          <View style={styles.icon}>
            <Ionicons name={icon} size={28} color={LightColors.primary} />
          </View>
          <Text style={styles.title} accessibilityRole="header">
            {title}
          </Text>
          <Text style={styles.message}>{message}</Text>
          {!!error && (
            <Text style={styles.error} accessibilityRole="alert">
              {error}
            </Text>
          )}
          <View style={styles.actions}>
            <Pressable
              onPress={cancel}
              disabled={busy}
              accessibilityRole="button"
              style={[styles.button, styles.cancel, busy && styles.disabled]}
            >
              <Text style={styles.cancelText}>{cancelLabel}</Text>
            </Pressable>
            <Pressable
              onPress={onConfirm}
              disabled={busy}
              accessibilityRole="button"
              accessibilityLabel={confirmLabel}
              accessibilityState={{ disabled: busy, busy }}
              style={[styles.button, styles.confirm, busy && styles.disabled]}
            >
              {busy ? (
                <ActivityIndicator color="#FFFFFF" size="small" />
              ) : (
                <Ionicons name={icon} size={18} color="#FFFFFF" />
              )}
              <Text style={styles.confirmText}>{confirmLabel}</Text>
            </Pressable>
          </View>
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: 'rgba(15, 30, 54, 0.45)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 24,
  },
  dialog: {
    backgroundColor: '#FFFFFF',
    width: '100%',
    maxWidth: 380,
    borderRadius: 24,
    padding: 24,
    borderWidth: 1,
    borderColor: '#E1EAF5',
    shadowColor: '#10294C',
    shadowOpacity: 0.18,
    shadowRadius: 28,
    shadowOffset: { width: 0, height: 10 },
    elevation: 12,
  },
  icon: {
    width: 60,
    height: 60,
    borderRadius: 20,
    backgroundColor: '#EAF2FF',
    alignItems: 'center',
    justifyContent: 'center',
    alignSelf: 'center',
    marginBottom: 18,
  },
  title: {
    color: LightColors.text,
    fontSize: 23,
    fontWeight: '800',
    textAlign: 'center',
    marginBottom: 10,
  },
  message: {
    color: LightColors.secondaryText,
    ...MobileTypography.body,

    textAlign: 'center',
    marginBottom: 24,
  },
  error: {
    color: '#B43545',
    backgroundColor: '#FFF0F2',
    padding: 12,
    borderRadius: 12,
    ...MobileTypography.caption,
    marginBottom: 16,
  },
  actions: { flexDirection: 'row', gap: 12 },
  button: {
    flex: 1,
    minHeight: 48,
    borderRadius: 14,
    flexDirection: 'row',
    gap: 8,
    alignItems: 'center',
    justifyContent: 'center',
  },
  cancel: { backgroundColor: '#F3F7FC', borderWidth: 1, borderColor: '#DFE7F1' },
  confirm: { backgroundColor: LightColors.primary },
  cancelText: { color: LightColors.secondaryText, ...MobileTypography.button, fontWeight: '600' },
  confirmText: {
    color: '#FFFFFF',
    ...MobileTypography.button,
    fontWeight: '700',
    flexShrink: 1,
    textAlign: 'center',
  },
  disabled: { opacity: 0.65 },
});
