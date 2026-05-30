export interface MenuItem {
  nativeName: string;
  translatedName: string;
  description: string;
  price: string;
  dietaryFlags: "safe" | "warning" | "critical_avoid";
  isHighlight?: boolean;
  conflictReason?: string;
}

export interface MenuCategory {
  categoryName: string;
  items: MenuItem[];
}

export interface MenuData {
  categories: MenuCategory[];
}

export interface ReceiptItem {
  originalName: string;
  translatedName: string;
  price: string;
}

export interface ReceiptData {
  currencySymbol: string;
  subtotal: string;
  tax: string;
  serviceCharge: string;
  total: string;
  items: ReceiptItem[];
}

export interface ScanResult {
  title: string;
  userAnswer?: string;
  mapLocationName?: string;
  languageCode?: string;
  badges: { type: 'warn' | 'good' | 'info'; text: string }[];
  notes: { title: string; body: string }[];
  menuData?: MenuData; 
  receiptData?: ReceiptData;
}
