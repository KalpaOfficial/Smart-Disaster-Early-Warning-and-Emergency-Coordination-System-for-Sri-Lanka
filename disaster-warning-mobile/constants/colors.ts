/**
 * Premium design system color palette tailored for emergency coordination.
 * Modern dark aesthetic with high contrast, glassmorphism tokens, and vibrant status semantics.
 */
export const Colors = {
  // Backgrounds
  bg: {
    primary: '#080C14',
    secondary: '#0F172A',
    tertiary: '#1E293B',
    elevated: '#24324D',
    overlay: 'rgba(3, 7, 18, 0.75)',
    glass: 'rgba(15, 23, 42, 0.75)',
  },

  // Accents & Gradients
  accent: {
    primary: '#38BDF8',
    secondary: '#818CF8',
    emerald: '#10B981',
    amber: '#F59E0B',
    rose: '#F43F5E',
    gradient: ['#0284C7', '#38BDF8'] as const,
    gradientPurple: ['#4F46E5', '#818CF8'] as const,
    gradientEmergency: ['#DC2626', '#EF4444'] as const,
    gradientSuccess: ['#059669', '#10B981'] as const,
    gradientCard: ['#16213E', '#0F172A'] as const,
  },

  // Semantics
  success: '#10B981',
  successBg: 'rgba(16, 185, 129, 0.12)',
  successBorder: '#059669',

  warning: '#F59E0B',
  warningBg: 'rgba(245, 158, 11, 0.12)',
  warningBorder: '#D97706',

  danger: '#EF4444',
  dangerBg: 'rgba(239, 68, 68, 0.12)',
  dangerBorder: '#DC2626',

  info: '#38BDF8',
  infoBg: 'rgba(56, 189, 248, 0.12)',
  infoBorder: '#0284C7',

  // Status mapping
  status: {
    success: '#10B981',
    warning: '#F59E0B',
    danger: '#EF4444',
    info: '#38BDF8',
  },

  // Typography
  text: {
    primary: '#F8FAFC',
    secondary: '#94A3B8',
    tertiary: '#64748B',
    muted: '#475569',
    inverse: '#080C14',
    accent: '#38BDF8',
  },

  // Borders & Dividers
  border: {
    default: 'rgba(255, 255, 255, 0.08)',
    light: 'rgba(255, 255, 255, 0.14)',
    focus: '#38BDF8',
    glow: 'rgba(56, 189, 248, 0.35)',
    dangerGlow: 'rgba(239, 68, 68, 0.35)',
  },

  // Input styling
  input: {
    bg: '#0D1527',
    border: 'rgba(255, 255, 255, 0.10)',
    focusBorder: '#38BDF8',
    placeholder: '#64748B',
    text: '#F8FAFC',
  },

  // Resource coordination specific tokens
  shelter: {
    registered: '#60A5FA',
    active: '#10B981',
    inactive: '#64748B',
    overCapacity: '#EF4444',
  },

  team: {
    available: '#10B981',
    dispatched: '#F59E0B',
    enRoute: '#FB923C',
    onSite: '#38BDF8',
    completed: '#64748B',
    unavailable: '#EF4444',
  },

  supply: {
    food: '#FB923C',
    water: '#38BDF8',
    medicine: '#EF4444',
    blankets: '#A78BFA',
    tents: '#10B981',
  },
} as const;

export const Spacing = {
  xs: 4,
  sm: 8,
  md: 12,
  lg: 16,
  xl: 20,
  xxl: 24,
  xxxl: 32,
  huge: 40,
} as const;

export const BorderRadius = {
  xs: 6,
  sm: 10,
  md: 14,
  lg: 18,
  xl: 24,
  xxl: 32,
  full: 9999,
} as const;

export const FontSize = {
  micro: 10,
  xs: 12,
  sm: 13,
  md: 15,
  lg: 17,
  xl: 20,
  xxl: 24,
  xxxl: 28,
  display: 34,
} as const;
