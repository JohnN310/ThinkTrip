import React, { createContext, useState, useContext, ReactNode, useEffect } from 'react';
import { doc, getDoc, setDoc } from 'firebase/firestore';
import { db } from '../lib/firebase';
import { useAuth } from '../contexts/AuthContext';

interface AlbumContextType {
  visitedCountries: string[];
  addCountry: (country: string) => Promise<void>;
}

const AlbumContext = createContext<AlbumContextType>({
  visitedCountries: [],
  addCountry: async () => {},
});

export function AlbumProvider({ children }: { children: ReactNode }) {
  const [visitedCountries, setVisitedCountries] = useState<string[]>([]);
  const { user } = useAuth();

  useEffect(() => {
    async function fetchCountries() {
      if (!user) {
        setVisitedCountries(['Japan', 'France']); // fallback if not logged in
        return;
      }
      try {
        const docRef = doc(db, 'users', user.uid);
        const docSnap = await getDoc(docRef);
        if (docSnap.exists() && docSnap.data().visitedCountries) {
          setVisitedCountries(docSnap.data().visitedCountries);
        } else {
          setVisitedCountries(['Japan', 'France']); // default starting countries
        }
      } catch (e) {
        console.error("Error fetching visited countries:", e);
      }
    }
    fetchCountries();
  }, [user]);

  const addCountry = async (country: string) => {
    if (visitedCountries.includes(country)) return;
    
    const newCountries = [country, ...visitedCountries];
    setVisitedCountries(newCountries);

    if (user) {
      try {
        const docRef = doc(db, 'users', user.uid);
        // We use merge: true so we don't overwrite other fields like 'onboardingComplete'
        await setDoc(docRef, { visitedCountries: newCountries }, { merge: true });
      } catch (e) {
        console.error("Error saving visited country:", e);
      }
    }
  };

  return (
    <AlbumContext.Provider value={{ visitedCountries, addCountry }}>
      {children}
    </AlbumContext.Provider>
  );
}

export const useAlbum = () => useContext(AlbumContext);
