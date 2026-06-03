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
  convertedPrice?: string;
}

export interface ReceiptData {
  currencySymbol: string;
  subtotal: string;
  convertedSubtotal?: string;
  tax: string;
  convertedTax?: string;
  serviceCharge: string;
  convertedServiceCharge?: string;
  total: string;
  convertedTotal?: string;
  items: ReceiptItem[];
}

export interface SignData {
  originalText: string;
  translatedText: string;
  instruction: string;
}

export interface ScanResult {
  title: string;
  userAnswer?: string;
  languageCode?: string;
  badges: { type: 'warn' | 'good' | 'info'; text: string }[];
  notes: { title: string; body: string }[];
  menuData?: MenuData; 
  receiptData?: ReceiptData;
  signData?: SignData;
}
