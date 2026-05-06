import { useColorScheme } from 'react-native';
import { lightTheme, darkTheme } from '../constants/colors';
import { useProfile } from '../contexts/ProfileContext';

export function useColors() {
  const systemColorScheme = useColorScheme();
  const { profile } = useProfile();
  
  const themePreference = profile?.themePreference || 'system';
  
  const isDark = themePreference === 'system' 
    ? systemColorScheme === 'dark'
    : themePreference === 'dark';

  return {
    ...(isDark ? darkTheme : lightTheme),
    isDark,
  };
}
