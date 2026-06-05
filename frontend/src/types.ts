// Shared types mirroring the backend API schemas.

export type Role = 'stock_handler' | 'manager' | 'vendor';

export interface User {
  id: number;
  email: string;
  full_name: string;
  role: Role;
  city?: string | null;
  industry_id?: number | null;
  is_active: boolean;
  created_at: string;
}

export interface Industry {
  id: number;
  name: string;
  slug: string;
}

export type MaterialStatus = 'ok' | 'low' | 'critical';

export interface Material {
  id: number;
  name: string;
  unit: string;
  current_stock: number;
  threshold: number;
  target_stock: number;
  weather_sensitive: boolean;
  industry_id: number;
  status: MaterialStatus;
  created_at: string;
}

export type MovementType = 'consumption' | 'delivery' | 'adjustment' | 'initial';

export interface Movement {
  id: number;
  material_id: number;
  quantity: number;
  movement_type: MovementType;
  note?: string | null;
  balance_after: number;
  created_at: string;
  created_by_id?: number | null;
}

export interface Offer {
  id: number;
  vendor_id: number;
  material_id: number;
  price_per_unit: number;
  eta_days: number;
  available_quantity: number;
  is_active: boolean;
  created_at: string;
  material_name?: string | null;
  vendor_name?: string | null;
}

export interface DailyUsage {
  date: string;
  consumed: number;
  delivered: number;
}

export const ROLE_LABELS: Record<Role, string> = {
  manager: 'Manager',
  stock_handler: 'Stock Handler',
  vendor: 'Vendor',
};

export function dashboardPath(role: Role): string {
  return { manager: '/app/manager', stock_handler: '/app/stock', vendor: '/app/vendor' }[role];
}

export type POStatus = 'suggested' | 'approved' | 'rejected' | 'ordered' | 'delivered' | 'cancelled';

export interface PurchaseOrder {
  id: number;
  material_id: number;
  vendor_id: number;
  quantity: number;
  price_per_unit: number;
  total_price: number;
  eta_days: number;
  status: POStatus;
  rationale?: string | null;
  created_at: string;
  decided_at?: string | null;
  material_name?: string | null;
  vendor_name?: string | null;
}

export interface WeatherDay {
  date: string;
  condition: string;
  precipitation_mm: number;
  temp_max_c?: number | null;
  rain: boolean;
}

export interface Weather {
  city: string;
  source: string;
  condition: string;
  temp_c?: number | null;
  precipitation_mm: number;
  will_rain: boolean;
  days: WeatherDay[];
  advisory: string[];
}
