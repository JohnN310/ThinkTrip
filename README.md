# ThinkTrip

**ThinkTrip** is your personal, AI-powered travel companion that cares about your well-being as much as your itinerary. 

Unlike standard travel apps, ThinkTrip connects your personal health baseline—like your skin type, dietary needs, and activity levels—with real-time data to give you advice that actually matters for *you*.

---

## What can ThinkTrip do?

### 🗺️ Plan with Intelligence
Get a live look at your destination. We don't just show you the temperature; we analyze air quality, humidity, and UV levels to tell you exactly what to pack.
- **Dynamic Packing Lists:** Automatically generated based on your health profile and the weather forecast.
- **5-Day Outlook:** Deep-dive into morning, afternoon, and evening conditions.
- **Heads-up Alerts:** Real-time warnings for extreme weather or pollution.

### 📸 Scan Your Surroundings
Use your camera to decode the world around you. Powered by Gemini AI, the Scan tool understands context.
- **Menu Intelligence:** Checks ingredients against your allergies and dietary goals.
- **Payment Etiquette:** Explains local currency and tipping customs so you're never unsure at the checkout.
- **Transit Decoding:** Reads signage and boarding procedures to keep you moving smoothly.

### 👤 Your Health Baseline
ThinkTrip stays personal. Your profile stores your skin type, dietary restrictions, and travel preferences to ensure every recommendation is tailored to your body's needs.

---

## Tech Stack

ThinkTrip is built with a modern, high-performance stack:
- **Frontend:** React Native & Expo (using the latest Expo Router).
- **Intelligence:** Google Gemini AI for vision and scene analysis.
- **Backend:** Firebase (Auth & Firestore) for secure, cross-device syncing.
- **Data:** Live integration with OpenWeather API.

---

## Getting Started

1. **Install dependencies:**
   ```bash
   npm install
   ```

2. **Set up your environment:**
   Create a `.env` file and add your API keys:
   - `EXPO_PUBLIC_OPENWEATHER_API_KEY`
   - `EXPO_PUBLIC_GEMINI_API_KEY`
   - Firebase configuration details.

3. **Run the app:**
   ```bash
   npx expo start
   ```

---

## Design Philosophy
We believe travel apps should be calm and premium. ThinkTrip uses a curated earthy palette, clean typography (Inter), and subtle haptics to feel more like a wellness tool than a cluttered dashboard.

---

*Travel smart. Travel healthy. ThinkTrip.*
