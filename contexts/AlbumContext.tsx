import React, { createContext, useState, useContext, ReactNode, useEffect } from 'react';
import { doc, getDoc, setDoc, deleteDoc } from 'firebase/firestore';
import { db, storage } from '../lib/firebase';
import { ref, deleteObject } from 'firebase/storage';
import { useAuth } from '../contexts/AuthContext';

export interface AlbumMeta {
  country: string;
  flag: string | null;
  latestPhotoUrl: string | null;
  secondPhotoUrl?: string | null;
  photoCount: number;
  lastUpdated: number;
}

interface AlbumContextType {
  visitedCountries: AlbumMeta[];
  addCountry: (country: string) => Promise<void>;
  removeCountry: (country: string) => Promise<void>;
  updateAlbumMeta: (country: string, latestPhotoUrl: string | null, secondPhotoUrl: string | null, photoCount: number) => Promise<void>;
}

const defaultAlbums: AlbumMeta[] = [];

const AlbumContext = createContext<AlbumContextType>({
  visitedCountries: [],
  addCountry: async () => {},
  removeCountry: async () => {},
  updateAlbumMeta: async () => {}
});

export function AlbumProvider({ children }: { children: ReactNode }) {
  const [visitedCountries, setVisitedCountries] = useState<AlbumMeta[]>([]);
  const { user } = useAuth();

  useEffect(() => {
    async function fetchCountries() {
      if (!user) {
        setVisitedCountries(defaultAlbums);
        return;
      }
      try {
        const docRef = doc(db, 'profiles', user.uid);
        const docSnap = await getDoc(docRef);
        if (docSnap.exists() && docSnap.data().visitedCountries) {
          let data = docSnap.data().visitedCountries;
          // Convert legacy string array
          if (data.length > 0 && typeof data[0] === 'string') {
            data = data.map((country: string) => ({
              country,
              flag: null,
              latestPhotoUrl: null,
              photoCount: 0,
              lastUpdated: Date.now()
            }));
          }
          // Sort by lastUpdated descending
          data.sort((a: AlbumMeta, b: AlbumMeta) => b.lastUpdated - a.lastUpdated);
          setVisitedCountries(data);
        } else {
          setVisitedCountries(defaultAlbums);
        }
      } catch (e) {
        console.error("Error fetching visited countries:", e);
      }
    }
    fetchCountries();
  }, [user]);

  const fetchFlag = async (country: string) => {
    try {
      const response = await fetch(`https://restcountries.com/v3.1/name/${encodeURIComponent(country)}`);
      const result = await response.json();
      if (result && result[0] && result[0].flag) {
        return result[0].flag;
      }
    } catch (e) {
      console.warn('Failed to fetch flag for', country, e);
    }
    return null;
  };

  const addCountry = async (country: string) => {
    if (visitedCountries.some(c => c.country === country)) return;
    
    const flag = await fetchFlag(country);
    const newAlbum: AlbumMeta = {
      country,
      flag,
      latestPhotoUrl: null,
      photoCount: 0,
      lastUpdated: Date.now()
    };
    
    const newCountries = [newAlbum, ...visitedCountries];
    setVisitedCountries(newCountries);

    if (user) {
      try {
        const docRef = doc(db, 'profiles', user.uid);
        await setDoc(docRef, { visitedCountries: newCountries }, { merge: true });
      } catch (e) {
        console.error("Error saving visited country:", e);
      }
    }
  };

  const updateAlbumMeta = async (country: string, latestPhotoUrl: string | null, secondPhotoUrl: string | null, photoCount: number) => {
    const existingIndex = visitedCountries.findIndex(c => c.country === country);
    if (existingIndex === -1) return;

    const newCountries = [...visitedCountries];
    newCountries[existingIndex] = {
      ...newCountries[existingIndex],
      latestPhotoUrl,
      secondPhotoUrl,
      photoCount,
      lastUpdated: Date.now()
    };
    
    newCountries.sort((a, b) => b.lastUpdated - a.lastUpdated);
    setVisitedCountries(newCountries);

    if (user) {
      try {
        const docRef = doc(db, 'profiles', user.uid);
        await setDoc(docRef, { visitedCountries: newCountries }, { merge: true });
      } catch (e) {
        console.error("Error updating album meta:", e);
      }
    }
  };

  const removeCountry = async (country: string) => {
    // Optimistically update UI
    const newCountries = visitedCountries.filter(c => c.country !== country);
    setVisitedCountries(newCountries);

    if (user) {
      try {
        // 1. Remove from user's visitedCountries array in Firestore
        const userDocRef = doc(db, 'profiles', user.uid);
        await setDoc(userDocRef, { visitedCountries: newCountries }, { merge: true });

        // 2. Fetch the album subcollection doc to get photo URLs
        const albumDocRef = doc(db, 'users', user.uid, 'albums', country);
        const albumSnap = await getDoc(albumDocRef);
        
        if (albumSnap.exists() && albumSnap.data().photos) {
          const photos: string[] = albumSnap.data().photos;
          
          // 3. Delete each photo from Firebase Storage
          for (const photoUrl of photos) {
            if (photoUrl.includes('firebasestorage.googleapis.com')) {
              try {
                const storageRef = ref(storage, photoUrl);
                await deleteObject(storageRef);
              } catch (err) {
                console.warn(`Failed to delete storage object for ${photoUrl}`, err);
              }
            }
          }
        }

        // 4. Delete the album Firestore document
        await deleteDoc(albumDocRef);

      } catch (e) {
        console.error("Error during complete country cleanup:", e);
      }
    }
  };

  return (
    <AlbumContext.Provider value={{ visitedCountries, addCountry, removeCountry, updateAlbumMeta }}>
      {children}
    </AlbumContext.Provider>
  );
}

export const useAlbum = () => useContext(AlbumContext);
