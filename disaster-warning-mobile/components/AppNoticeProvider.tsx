import React, { useEffect, useState } from 'react';
import { Modal, View, Text, Pressable, StyleSheet, ScrollView } from 'react-native';
import { LightColors, MobileTypography } from '@/constants/colors';
import {
  subscribeAppNotice,
  chooseAppNoticeButton,
  dismissAppNotice,
  type AppNotice,
} from '@/utils/appNotice';

export function AppNoticeProvider({ children }: { children: React.ReactNode }) {
  const [notice, setNotice] = useState<AppNotice | null>(null);
  useEffect(() => subscribeAppNotice(setNotice), []);
  return (
    <>
      {children}
      <Modal
        visible={!!notice}
        transparent
        animationType="fade"
        onRequestClose={() => notice && dismissAppNotice(notice)}
      >
        <View style={styles.overlay}>
          <View style={styles.dialog} accessibilityViewIsModal accessibilityRole="alert">
            <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={styles.content}>
              <Text style={styles.title}>{notice?.title}</Text>
              {!!notice?.message && <Text style={styles.message}>{notice.message}</Text>}
              <View style={styles.actions}>
                {notice?.buttons.map((button, index) => (
                  <Pressable
                    key={index}
                    accessibilityRole="button"
                    style={[
                      styles.button,
                      button.style === 'cancel'
                        ? styles.cancel
                        : button.style === 'destructive'
                          ? styles.danger
                          : styles.confirm,
                    ]}
                    onPress={() => chooseAppNoticeButton(notice, index)}
                  >
                    <Text
                      style={[
                        styles.buttonText,
                        button.style === 'cancel' && { color: LightColors.text },
                      ]}
                    >
                      {button.text || 'OK'}
                    </Text>
                  </Pressable>
                ))}
              </View>
            </ScrollView>
          </View>
        </View>
      </Modal>
    </>
  );
}
const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(10,25,48,0.5)',
    padding: 24,
  },
  dialog: {
    width: '100%',
    maxWidth: 420,
    borderRadius: 22,
    maxHeight: '85%',
    backgroundColor: '#FFFFFF',
  },
  content: { padding: 24, gap: 16 },
  title: { ...MobileTypography.section, color: LightColors.text, fontWeight: '700' },
  message: { ...MobileTypography.body, color: LightColors.secondaryText },
  actions: { gap: 10 },
  button: {
    minHeight: 48,
    padding: 12,
    borderRadius: 14,
    alignItems: 'center',
    justifyContent: 'center',
  },
  confirm: { backgroundColor: LightColors.primary },
  danger: { backgroundColor: LightColors.danger },
  cancel: { backgroundColor: LightColors.background },
  buttonText: { ...MobileTypography.button, color: '#FFFFFF', fontWeight: '700' },
});
