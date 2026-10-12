import type { AlertButton, AlertOptions } from 'react-native';

export interface AppNotice {
  title: string;
  message: string;
  buttons: AlertButton[];
  options?: AlertOptions;
}
let queue: AppNotice[] = [];
const listeners = new Set<(notice: AppNotice | null) => void>();
const publish = () => listeners.forEach(listener => listener(queue[0] || null));
export const AppAlert = {
  alert(title: string, message = '', buttons?: AlertButton[], options?: AlertOptions) {
    queue.push({ title, message, buttons: buttons?.length ? buttons : [{ text: 'OK' }], options });
    publish();
  },
};
export function subscribeAppNotice(listener: (notice: AppNotice | null) => void) {
  listeners.add(listener);
  listener(queue[0] || null);
  return () => {
    listeners.delete(listener);
  };
}
export function chooseAppNoticeButton(notice: AppNotice, index: number) {
  if (queue[0] !== notice || !notice.buttons[index]) return;
  queue = queue.slice(1);
  publish();
  notice.buttons[index].onPress?.();
}
export function dismissAppNotice(notice: AppNotice) {
  if (queue[0] !== notice) return;
  const cancel = notice.buttons.findIndex(button => button.style === 'cancel');
  if (cancel >= 0) chooseAppNoticeButton(notice, cancel);
  else if (notice.options?.cancelable) {
    queue = queue.slice(1);
    publish();
    notice.options.onDismiss?.();
  }
}
