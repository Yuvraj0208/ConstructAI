// Shared types mirroring the backend API schemas.

export type Role = 'stock_handler' | 'manager' | 'vendor' | 'site_engineer';

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

export interface Site {
  id: number;
  name: string;
  code?: string | null;
  city?: string | null;
  industry_id: number;
  is_active: boolean;
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
  shelf_life_days?: number | null;
  reserve_percent: number;
  reserved_quantity: number;
  available_stock: number;
  below_reserve: boolean;
  site_id: number;
  status: MaterialStatus;
  created_at: string;
}

export type ExpiryStatus = 'fresh' | 'expiring' | 'expired';

export interface StockBatch {
  id: number;
  material_id: number;
  material_name?: string | null;
  unit?: string | null;
  original_quantity: number;
  remaining_quantity: number;
  received_at: string;
  expiry_date?: string | null;
  days_to_expiry?: number | null;
  expiry_status: ExpiryStatus;
  note?: string | null;
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
  site_engineer: 'Site Engineer',
};

export function dashboardPath(role: Role): string {
  return {
    manager: '/app/manager',
    stock_handler: '/app/stock',
    vendor: '/app/vendor',
    site_engineer: '/app/engineer',
  }[role];
}

export type RequestStatus = 'pending' | 'issued' | 'rejected';

export interface MaterialRequestItem {
  material_id: number;
  material_name?: string | null;
  unit?: string | null;
  quantity: number;
}

export interface MaterialRequest {
  id: number;
  site_id: number;
  requested_by_id?: number | null;
  requester_name?: string | null;
  status: RequestStatus;
  needed_for?: string | null;
  note?: string | null;
  created_at: string;
  decided_at?: string | null;
  items: MaterialRequestItem[];
}

export interface DailyUpdate {
  id: number;
  site_id: number;
  author_id?: number | null;
  author_name?: string | null;
  progress_percent: number;
  summary: string;
  labor_count: number;
  issues?: string | null;
  weather_impact?: string | null;
  created_at: string;
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
