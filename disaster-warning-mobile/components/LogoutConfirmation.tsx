import React, { createContext, useCallback, useContext, useRef, useState } from 'react';
import { useAuth } from '@/hooks/useAuth';
import { ConfirmationDialog } from './ConfirmationDialog';

const LogoutConfirmationContext = createContext<(() => void) | null>(null);

export function useLogoutConfirmation() {
  const requestLogout = useContext(LogoutConfirmationContext);
  if (!requestLogout) throw new Error('Logout confirmation provider is unavailable.');
  return requestLogout;
}

export function LogoutConfirmationProvider({ children }: { children: React.ReactNode }) {
  const { logout } = useAuth();
  const [visible, setVisible] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const pending = useRef(false);
  const requestLogout = useCallback(() => {
    if (pending.current) return;
    setError('');
    setVisible(true);
  }, []);
  const cancel = () => {
    if (!pending.current) setVisible(false);
  };
  const confirm = async () => {
    if (pending.current) return;
    pending.current = true;
    setBusy(true);
    setError('');
    try {
      await logout();
      setVisible(false);
    } catch {
      setError('Could not sign out. Please try again.');
    } finally {
      pending.current = false;
      setBusy(false);
    }
  };
  return (
    <LogoutConfirmationContext.Provider value={requestLogout}>
      {children}
      <ConfirmationDialog
        visible={visible}
        title="Sign out?"
        message="You can sign in again at any time to access your account."
        confirmLabel={busy ? 'Signing out...' : 'Sign out'}
        icon="log-out-outline"
        busy={busy}
        error={error}
        onCancel={cancel}
        onConfirm={() => void confirm()}
      />
    </LogoutConfirmationContext.Provider>
  );
}
