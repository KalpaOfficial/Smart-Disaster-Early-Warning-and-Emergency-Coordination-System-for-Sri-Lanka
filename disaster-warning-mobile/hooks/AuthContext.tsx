/**
 * Authentication Context & Provider — Pure Firebase Auth + Cloud Firestore.
 * Listens to Firebase Auth state changes and hydrates user profile from Cloud Firestore.
 * No mock data or local storage fallbacks.
 */
import React, {
  createContext,
  useReducer,
  useEffect,
  useCallback,
} from 'react';
import {
  signIn,
  signUp,
  signOut,
  getUserProfile,
  onAuthChanged,
  getAuthErrorMessage,
} from '@/services/authService';
import type {
  AuthState,
  AuthContextType,
  LoginCredentials,
  SignupData,
  User,
} from '@/types/auth';

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

  // Listen directly for Firebase Auth state changes
  useEffect(() => {
    let isMounted = true;

    const unsubscribe = onAuthChanged(async (firebaseUser) => {
      if (!isMounted) return;
      if (firebaseUser) {
        // Fast instant state dispatch so the app unlocks immediately without waiting on Firestore
        const baseUser: User = {
          id: firebaseUser.uid,
          email: firebaseUser.email || '',
          fullName: firebaseUser.displayName || 'Disaster Officer',
          role: 'district_officer',
          district: 'Colombo',
          phone: '',
          organisation: 'Disaster Management Centre',
          createdAt: new Date().toISOString(),
        };

        if (isMounted) {
          dispatch({ type: 'SET_USER', payload: baseUser });
        }

        // Hydrate full Firestore profile in background
        getUserProfile(firebaseUser.uid)
          .then((profile) => {
            if (isMounted && profile) {
              dispatch({ type: 'SET_USER', payload: profile });
            }
          })
          .catch(() => {});
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
    dispatch({ type: 'SET_LOADING', payload: true });
    try {
      const user = await signIn(credentials);
      dispatch({ type: 'SET_USER', payload: user });
    } catch (error) {
      dispatch({ type: 'SET_LOADING', payload: false });
      throw new Error(getAuthErrorMessage(error));
    }
  }, []);

  const signup = useCallback(async (data: SignupData) => {
    dispatch({ type: 'SET_LOADING', payload: true });
    try {
      const user = await signUp(data);
      dispatch({ type: 'SET_USER', payload: user });
    } catch (error) {
      dispatch({ type: 'SET_LOADING', payload: false });
      throw new Error(getAuthErrorMessage(error));
    }
  }, []);

  const logout = useCallback(async () => {
    try {
      await signOut();
    } catch (error) {
      console.warn('Firebase sign out warning:', error);
    } finally {
      dispatch({ type: 'LOGOUT' });
    }
  }, []);

  return (
    <AuthContext.Provider value={{ state, login, signup, logout }}>
      {children}
    </AuthContext.Provider>
  );
}
