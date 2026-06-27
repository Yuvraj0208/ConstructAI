// Trimmed API contracts shared with the ConstructAI backend (field-app subset).

export type Role = 'stock_handler' | 'manager' | 'vendor' | 'site_engineer';

export const ROLE_LABELS: Record<Role, string> = {
  manager: 'Manager',
  stock_handler: 'Stock Handler',
  vendor: 'Vendor',
  site_engineer: 'Site Engineer',
};

export interface User {
  id: number;
  email: string;
  full_name: string;
  role: Role;
  industry_id?: number | null;
  is_active: boolean;
  created_at: string;
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
  reserved_quantity: number;
  available_stock: number;
  below_reserve: boolean;
  shelf_life_days?: number | null;
  site_id: number;
  status: MaterialStatus;
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
  requester_name?: string | null;
  status: RequestStatus;
  needed_for?: string | null;
  note?: string | null;
  created_at: string;
  items: MaterialRequestItem[];
}

export interface DailyUpdate {
  id: number;
  site_id: number;
  author_name?: string | null;
  progress_percent: number;
  summary: string;
  labor_count: number;
  issues?: string | null;
  weather_impact?: string | null;
  created_at: string;
}

export type POStatus =
  | 'suggested'
  | 'approved'
  | 'rejected'
  | 'ordered'
  | 'delivered'
  | 'cancelled';

export interface PurchaseOrder {
  id: number;
  material_id: number;
  quantity: number;
  price_per_unit: number;
  total_price: number;
  eta_days: number;
  status: POStatus;
  material_name?: string | null;
  vendor_name?: string | null;
}

export interface SiteImageReport {
  id: number;
  site_id: number;
  caption?: string | null;
  progress_estimate?: number | null;
  summary: string;
  observations: string[];
  safety_flags: string[];
  materials_visible: string[];
  status: string;
  used_ai: boolean;
  created_at: string;
}

export interface SiteImageReportDetail extends SiteImageReport {
  image_data_url: string;
}
