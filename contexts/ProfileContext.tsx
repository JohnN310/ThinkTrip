import React, { createContext, useContext, useState, useEffect, ReactNode } from 'react';
import { doc, getDoc, setDoc } from 'firebase/firestore';
import { db } from '../lib/firebase';
import { useAuth } from './AuthContext';
import { ProfileContextState } from '../lib/packingList';

// Add the default empty array for savedLocations
const DEFAULT_PROFILE: ProfileContextState = {
  displayName: '',
  email: '',
  homeCity: '',
  skinType: 'combination',
  usesRetinoids: false,
  usesBenzoylPeroxide: false,
  usesChemicalExfoliants: false,
  fragranceFree: false,
  sodiumSensitive: false,
  caffeineLimit: false,
  glutenFree: false,
  dairyFree: false,
  shellfishAllergy: false,
  peanutAllergy: false,
  activityLevel: 'moderate',
  travelType: 'vacation',
  units: 'metric',
  hapticsEnabled: true,
  liveAlertsEnabled: false,
  savedLocations: [],
  avatarEmoji: '',
  avatarColor: '#0d3b3a',
  themePreference: 'system',
};

interface ProfileContextValue {
  profile: ProfileContextState;
  draft: ProfileContextState;
  isDirty: boolean;
  hydrated: boolean;
  setDraft: (updates: Partial<ProfileContextState>) => void;
  save: (overrides?: Partial<ProfileContextState>) => Promise<void>;
  reset: () => void;
  toggleSavedLocation: (cityName: string) => Promise<void>; // New instant-save function
}

const ProfileContext = createContext<ProfileContextValue | null>(null);

export const useProfile = () => {
  const ctx = useContext(ProfileContext);
  if (!ctx) throw new Error('useProfile must be used within a ProfileProvider');
  return ctx;
};

export const ProfileProvider = ({ children }: { children: ReactNode }) => {
  const { user, loading: authLoading } = useAuth();
  const [profile, setProfile] = useState<ProfileContextState>(DEFAULT_PROFILE);
  const [draft, setDraftState] = useState<ProfileContextState>(DEFAULT_PROFILE);
  const [hydrated, setHydrated] = useState(false);

  useEffect(() => {
    if (authLoading) return; // Wait until AuthContext finishes checking the initial state

    const loadProfile = async () => {
      if (!user) {
        setProfile(DEFAULT_PROFILE);
        setDraftState(DEFAULT_PROFILE);
        setHydrated(true);
        return;
      }

      setHydrated(false);
      try {
        const docRef = doc(db, 'profiles', user.uid);
        const docSnap = await getDoc(docRef);

        if (docSnap.exists()) {
          const data = docSnap.data() as Partial<ProfileContextState>;
          // Ensure savedLocations defaults to an array if it doesn't exist on older documents
          const merged = {
            ...DEFAULT_PROFILE,
            ...data,
            email: user.email || data.email || '',
            savedLocations: data.savedLocations || []
          };
          setProfile(merged);
          setDraftState(merged);
        } else {
          const initialProfile = { ...DEFAULT_PROFILE, email: user.email || '' };
          setProfile(initialProfile);
          setDraftState(initialProfile);
        }
      } catch (e) {
        console.error('Failed to load profile from Firestore', e);
      } finally {
        setHydrated(true);
      }
    };

    loadProfile();
  }, [user, authLoading]);

  const setDraft = (updates: Partial<ProfileContextState>) => {
    setDraftState((prev) => ({ ...prev, ...updates }));
  };

  const isDirty = JSON.stringify(profile) !== JSON.stringify(draft);

  const save = async (overrides?: Partial<ProfileContextState>) => {
    if (!user) {
      console.error('Cannot save profile: No authenticated user.');
      return;
    }

    // Merge the current draft with any immediate overrides
    const finalData = { ...draft, ...overrides };

    try {
      const docRef = doc(db, 'profiles', user.uid);
      await setDoc(docRef, finalData, { merge: true });

      // Immediately update local state to reflect the successfully saved data
      setProfile(finalData);
      setDraftState(finalData);
    } catch (e) {
      console.error('Failed to save profile to Firestore', e);
      throw e;
    }
  };

  const reset = () => {
    setDraftState(profile);
  };

  // Instant save function exclusively for the Watchlist
  const toggleSavedLocation = async (cityName: string) => {
    if (!user) return;

    const currentList = profile.savedLocations || [];
    const isSaved = currentList.includes(cityName);
    let newList;

    if (isSaved) {
      newList = currentList.filter(city => city !== cityName);
    } else {
      newList = [cityName, ...currentList];
    }

    // Optimistically update local state for a snappy UI
    const updatedProfile = { ...profile, savedLocations: newList };
    setProfile(updatedProfile);
    setDraftState(updatedProfile);

    // Sync to Firestore in the background
    try {
      const docRef = doc(db, 'profiles', user.uid);
      await setDoc(docRef, { savedLocations: newList }, { merge: true });
    } catch (e) {
      console.error('Failed to toggle saved location', e);
      // Revert if network fails
      setProfile(profile);
      setDraftState(draft);
    }
  };

  return (
    <ProfileContext.Provider value={{ profile, draft, isDirty, hydrated, setDraft, save, reset, toggleSavedLocation }}>
      {children}
    </ProfileContext.Provider>
  );
};