export const lightTheme = {
  text: '#1e293b',
  foreground: '#1e293b',
  background: '#f8fafc',
  card: '#ffffff',
  cardForeground: '#1e293b',
  primary: '#5c7ce5', // Periwinkle Blue from new icon
  primaryForeground: '#f8fafc',
  secondary: '#eff6ff',
  secondaryForeground: '#1e293b',
  muted: '#f1f5f9',
  mutedForeground: '#475569',
  accent: '#f5b962',
  accentForeground: '#1e293b',
  destructive: '#e11d48',
  destructiveForeground: '#f8fafc',
  border: '#e2e8f0',
  input: '#e2e8f0',
  radius: 14,
};

export const darkTheme = {
  text: '#f8fafc',
  foreground: '#f8fafc',
  background: '#020617', // Deep Midnight Blue
  card: '#0f172a', // Slate 900
  cardForeground: '#f8fafc',
  primary: '#818cf8', // Indigo 400 - reactive and bright on dark
  primaryForeground: '#f8fafc',
  secondary: '#1e293b',
  secondaryForeground: '#f8fafc',
  muted: '#1e293b',
  mutedForeground: '#94a3b8',
  accent: '#f5b962',
  accentForeground: '#1e293b',
  destructive: '#f43f5e',
  destructiveForeground: '#f8fafc',
  border: '#1e293b',
  input: '#1e293b',
  radius: 14,
};

// Legacy export for backwards compatibility
export const Colors = {
  light: lightTheme,
  dark: darkTheme,
};
