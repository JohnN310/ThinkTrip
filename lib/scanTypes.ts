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
