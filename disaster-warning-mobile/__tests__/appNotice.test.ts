import {
  AppAlert,
  subscribeAppNotice,
  chooseAppNoticeButton,
  dismissAppNotice,
  type AppNotice,
} from '@/utils/appNotice';
let current: AppNotice | null = null;
let stop: () => void;
beforeEach(() => {
  stop = subscribeAppNotice(notice => {
    current = notice;
  });
});
afterEach(() => {
  while (current) chooseAppNoticeButton(current, 0);
  stop();
});
it('requires an explicit confirmation and runs a destructive action only once', () => {
  const remove = jest.fn();
  AppAlert.alert('Delete report?', 'Cannot undo', [
    { text: 'Cancel', style: 'cancel' },
    { text: 'Delete', style: 'destructive', onPress: remove },
  ]);
  expect(remove).not.toHaveBeenCalled();
  const active = current!;
  chooseAppNoticeButton(active, 9);
  expect(current).toBe(active);
  chooseAppNoticeButton(active, 1);
  chooseAppNoticeButton(active, 1);
  expect(remove).toHaveBeenCalledTimes(1);
  expect(current).toBeNull();
});
it('queues notices without losing confirmation callbacks', () => {
  AppAlert.alert('First');
  const first = current!;
  AppAlert.alert('Second', 'Message', []);
  expect(current?.title).toBe('First');
  expect(first.buttons).toEqual([{ text: 'OK' }]);
  chooseAppNoticeButton(first, 0);
  expect(current?.title).toBe('Second');
  chooseAppNoticeButton(current!, 0);
  expect(current).toBeNull();
});
it('cancels a confirmation without triggering the dangerous action', () => {
  const cancel = jest.fn(),
    confirm = jest.fn();
  AppAlert.alert('Confirm', '', [
    { text: 'Cancel', style: 'cancel', onPress: cancel },
    { text: 'Confirm', onPress: confirm },
  ]);
  dismissAppNotice(current!);
  expect(cancel).toHaveBeenCalledTimes(1);
  expect(confirm).not.toHaveBeenCalled();
});
it('respects non-dismissible notices and calls dismissal callbacks when enabled', () => {
  const dismiss = jest.fn();
  AppAlert.alert('Locked');
  const active = current!;
  dismissAppNotice(active);
  expect(current).toBe(active);
  chooseAppNoticeButton(active, 0);
  AppAlert.alert('Dismissible', '', undefined, { cancelable: true, onDismiss: dismiss });
  dismissAppNotice(current!);
  dismissAppNotice(active);
  expect(dismiss).toHaveBeenCalledTimes(1);
  expect(current).toBeNull();
});
