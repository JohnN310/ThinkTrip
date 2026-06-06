import { useState, useEffect } from 'react';

export interface CountryContent {
  facts: Array<{ title: string; description: string; emoji: string }>;
  places: Array<{ name: string; description: string; emoji: string }>;
  culture: Array<{ title: string; description: string; emoji: string }>;
  events: Array<{ name: string; date: string; description: string }>;
}

const MOCK_DATA: Record<string, CountryContent> = {
  default: {
    facts: [
      { title: 'Local Currency', description: 'Ensure you have some local currency on hand for small vendors.', emoji: '💵' },
      { title: 'Timezone', description: 'Be mindful of the time difference to avoid jetlag.', emoji: '🕒' },
      { title: 'Best Time to Visit', description: 'Shoulder seasons often offer the best balance of weather and crowds.', emoji: '🌤️' },
    ],
    places: [
      { name: 'Historic City Center', description: 'A maze of cobblestone streets and stunning architecture.', emoji: '🏛️' },
      { name: 'Local Markets', description: 'Experience the vibrant colors and tastes of the region.', emoji: '🛍️' },
    ],
    culture: [
      { title: 'Greetings', description: 'A polite greeting in the local language goes a long way.', emoji: '🤝' },
      { title: 'Tipping', description: 'Check local customs; tipping may be included or unnecessary.', emoji: '🍽️' },
    ],
    events: [
      { name: 'Summer Festival', date: 'August', description: 'A vibrant celebration of music and arts.' },
    ],
  },
  'japan': {
    facts: [
      { title: 'Vending Machines', description: 'Japan has over 1 vending machine for every 23 people, selling everything from hot coffee to umbrellas.', emoji: '🧃' },
      { title: 'Train Precision', description: 'Trains are so punctual that a 1-minute delay comes with an official apology certificate.', emoji: '🚅' },
      { title: 'Capsule Hotels', description: 'Invented in Japan in 1979 for businessmen to sleep affordably.', emoji: '🛏️' },
    ],
    places: [
      { name: 'Shibuya Crossing', description: 'The busiest pedestrian crossing in the world.', emoji: '🚶' },
      { name: 'Senso-ji Temple', description: 'Tokyo’s oldest Buddhist temple located in Asakusa.', emoji: '🏮' },
      { name: 'Kyoto Temples', description: 'Explore thousands of classical Buddhist temples and Shinto shrines.', emoji: '⛩️' },
    ],
    culture: [
      { title: 'Bowing', description: 'Bowing is the standard greeting. A slight nod is fine for foreigners.', emoji: '🙇' },
      { title: 'No Tipping', description: 'Tipping is not customary and may even be considered rude.', emoji: '🚫' },
      { title: 'Chopsticks', description: 'Never pass food chopstick-to-chopstick or stick them vertically in rice.', emoji: '🥢' },
    ],
    events: [
      { name: 'Cherry Blossom Season', date: 'Late March - Early April', description: 'Hanami (flower viewing) festivals across the country parks.' },
      { name: 'Gion Matsuri', date: 'July', description: 'One of the most famous festivals in Japan, taking place in Kyoto.' },
    ],
  },
  'france': {
    facts: [
      { title: 'The Eiffel Tower', description: 'It was originally intended to be a temporary structure for the 1889 World’s Fair.', emoji: '🗼' },
      { title: 'Louvre Size', description: 'It would take 100 days to see every piece of art in the Louvre if you spent 30 seconds on each.', emoji: '🖼️' },
      { title: 'Cheese Variety', description: 'There are over 400 distinct types of French cheese.', emoji: '🧀' },
    ],
    places: [
      { name: 'Montmartre', description: 'The historic artistic hub with stunning views from Sacré-Cœur.', emoji: '🎨' },
      { name: 'French Riviera', description: 'The Mediterranean coastline of the southeast corner of France.', emoji: '🌊' },
    ],
    culture: [
      { title: 'La Bise', description: 'Greeting friends with cheek kisses is standard practice.', emoji: '😘' },
      { title: 'Dining Time', description: 'Dinner typically starts late, around 8:00 PM or 9:00 PM.', emoji: '🍽️' },
    ],
    events: [
      { name: 'Bastille Day', date: 'July 14', description: 'Military parade on the Champs-Élysées and fireworks at the Eiffel Tower.' },
    ],
  }
};

export const useCountryContent = (countryName: string) => {
  const [data, setData] = useState<CountryContent | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    setIsLoading(true);
    // Simulate network latency for a realistic loading effect
    const timer = setTimeout(() => {
      const key = Object.keys(MOCK_DATA).find(k => countryName.toLowerCase().includes(k)) || 'default';
      setData(MOCK_DATA[key]);
      setIsLoading(false);
    }, 800);

    return () => clearTimeout(timer);
  }, [countryName]);

  return { data, isLoading };
};
