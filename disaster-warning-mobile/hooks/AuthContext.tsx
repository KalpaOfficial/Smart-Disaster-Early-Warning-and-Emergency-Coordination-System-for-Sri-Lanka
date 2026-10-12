/**
 * Authentication Context & Provider — Pure Firebase Auth + Cloud Firestore.
 * Listens to Firebase Auth state changes and hydrates user profile from Cloud Firestore.
 * No mock data or local storage fallbacks.
 */
import React, { createContext, useReducer, useEffect, useCallback, useRef } from 'react';
import {
  signIn,
  signUp,
  signOut,
  getUserProfile,
  onAuthChanged,
  getAuthErrorMessage,
} from '@/services/authService';
import type { AuthState, AuthContextType, LoginCredentials, SignupData, User } from '@/types/auth';

// --- Action Types ---

type AuthAction =
  | { type: 'SET_USER'; payload: User | null }
  | { type: 'SET_LOADING'; payload: boolean }
  | { type: 'LOGOUT' };

// --- Reducer ---

const initialState: AuthState = {
  user: null,
  isAuthenticated: false,
  isLoading: true,
};

function authReducer(state: AuthState, action: AuthAction): AuthState {
  switch (action.type) {
    case 'SET_USER':
      return {
        ...state,
        user: action.payload,
        isAuthenticated: !!action.payload,
        isLoading: false,
      };
    case 'SET_LOADING':
      return {
        ...state,
        isLoading: action.payload,
      };
    case 'LOGOUT':
      return {
        ...state,
        user: null,
        isAuthenticated: false,
        isLoading: false,
      };
    default:
      return state;
  }
}

// --- Context ---

export const AuthContext = createContext<AuthContextType | null>(null);

// --- Provider ---

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [state, dispatch] = useReducer(authReducer, initialState);
  const authActionInProgress = useRef(false);

  // Listen directly for Firebase Auth state changes
  useEffect(() => {
    let isMounted = true;
    let authRevision = 0;

    const unsubscribe = onAuthChanged(async firebaseUser => {
      if (!isMounted) return;
      const revision = ++authRevision;
      if (authActionInProgress.current) return;
      if (firebaseUser) {
        // Restore the persisted role before granting access; never assume an officer role.
        dispatch({ type: 'SET_LOADING', payload: true });
        const profile = await getUserProfile(firebaseUser.uid);
        if (isMounted && revision === authRevision) {
          dispatch({ type: 'SET_USER', payload: profile });
        }
      } else {
        if (isMounted) dispatch({ type: 'SET_USER', payload: null });
      }
    });

    return () => {
      isMounted = false;
      unsubscribe();
    };
  }, []);

  const login = useCallback(async (credentials: LoginCredentials) => {
    authActionInProgress.current = true;
    dispatch({ type: 'SET_LOADING', payload: true });
    try {
      const user = await signIn(credentials);
      dispatch({ type: 'SET_USER', payload: user });
    } catch (error) {
      dispatch({ type: 'SET_LOADING', payload: false });
      throw new Error(getAuthErrorMessage(error));
    } finally {
      authActionInProgress.current = false;
    }
  }, []);

  const signup = useCallback(async (data: SignupData) => {
    authActionInProgress.current = true;
    dispatch({ type: 'SET_LOADING', payload: true });
    try {
      const user = await signUp(data);
      dispatch({ type: 'SET_USER', payload: user });
    } catch (error) {
      dispatch({ type: 'SET_LOADING', payload: false });
      throw new Error(getAuthErrorMessage(error));
    } finally {
      authActionInProgress.current = false;
    }
  }, []);

  const logout = useCallback(async () => {
    try {
      await signOut();
      dispatch({ type: 'LOGOUT' });
    } catch (error) {
      throw new Error(getAuthErrorMessage(error));
    }
  }, []);

  return (
    <AuthContext.Provider value={{ state, login, signup, logout }}>{children}</AuthContext.Provider>
  );
}
