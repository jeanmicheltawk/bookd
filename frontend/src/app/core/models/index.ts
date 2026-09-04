// BOOK'D HAUS — shared frontend models
// Mirrors backend response shapes (see backend/src/controllers/*).

export type UserRole = 'member' | 'brand' | 'admin';
export type Membership = 'free' | 'basic' | 'premium' | 'visitor';
export type ApprovalStatus = 'pending' | 'approved' | 'rejected';

export type SubscriptionStatus = 'none' | 'trial' | 'active' | 'ending_soon' | 'expired' | 'complimentary';

export interface SubscriptionInfo {
  plan: string;
  plan_label: string;
  status: SubscriptionStatus;
  started_at: string | null;
  trial_ends_at: string | null;
  ends_at: string | null;
  days_remaining: number | null;
  in_trial: boolean;
  can_end: boolean;
  needs_reminder: boolean;
}

export interface User {
  id: string;
  email: string;
  role: UserRole;
  membership: Membership;
  effective_membership?: Membership;
  is_complimentary?: boolean;
  is_verified?: boolean;
  approval_status?: ApprovalStatus;
  created_at?: string;
  profile_id?: string;
  full_name?: string;
  professional_name?: string;
  profile_photo_url?: string;
  custom_url?: string;
  category_slug?: string;
  category_name?: string;
  membership_started_at?: string | null;
  membership_trial_ends_at?: string | null;
  membership_ends_at?: string | null;
  subscription?: SubscriptionInfo;
}

export interface AuthResponse {
  user: User;
  accessToken: string;
  refreshToken: string;
}

export type PaymentStatus = 'awaiting' | 'pending' | 'confirmed' | 'rejected';

export interface WhishRecipient {
  display: string;
  copy: string;
  digits: string;
}

export interface SubscriptionPayment {
  id: string;
  user_id: string;
  email?: string;
  full_name?: string | null;
  professional_name?: string | null;
  phone?: string | null;
  plan: string;
  plan_label: string;
  amount: number;
  currency: string;
  method: string;
  recipient_number: string;
  sender_whish_number?: string | null;
  reference: string;
  note?: string | null;
  status: PaymentStatus;
  submitted_at?: string | null;
  reviewed_at?: string | null;
  review_note?: string | null;
  created_at: string;
}

export interface WhishPaymentInstructions {
  method: 'whish_p2p';
  recipient: WhishRecipient;
  amount: number;
  currency: string;
  plan: string;
  plan_label: string;
  payment: SubscriptionPayment | null;
  suggested_whish_number?: string;
}

export type CancellationBy = 'self' | 'admin';

export interface SubscriptionCancellation {
  id: string;
  user_id: string | null;
  email: string;
  full_name?: string | null;
  professional_name?: string | null;
  plan: string;
  plan_label: string;
  cancelled_at: string;
  cancelled_by: CancellationBy;
  refund_done: boolean;
  refund_updated_at?: string | null;
}

export type CategoryFieldType = 'text' | 'number' | 'dropdown' | 'textarea';

export interface CategoryField {
  id: string;
  field_key: string;
  label: string;
  field_type: CategoryFieldType;
  options: string[];
  is_required: boolean;
  sort_order: number;
  category_id?: string;
  created_at?: string;
}

export interface Category {
  id: string;
  slug: string;
  name: string;
  is_searchable: boolean;
  sort_order: number;
  fields?: CategoryField[];
  created_at?: string;
}

export interface Country {
  id: string;
  slug: string;
  name: string;
  sort_order: number;
  created_at?: string;
}

export interface PortfolioItem {
  id: string;
  media_type: 'image' | 'video' | 'pdf';
  url: string;
  thumbnail_url?: string | null;
  title?: string | null;
  sort_order: number;
  view_count?: number;
  created_at?: string;
}

export interface Profile {
  id: string;
  user_id?: string;
  full_name: string;
  professional_name?: string;
  age?: number;
  country?: string;
  city?: string;
  gender?: string;
  instagram?: string;
  email_public?: string;
  bio?: string;
  languages?: string[];
  years_experience?: number;
  website?: string;
  profile_photo_url?: string;
  cover_photo_url?: string;
  equipment_owned?: string;
  studio_access?: boolean;
  brands_worked_with?: string[];
  social_links?: Record<string, string>;
  booking_preferences?: Record<string, unknown>;
  preferred_contact?: string;
  phone?: string;
  whatsapp?: string;
  availability?: string;
  custom_url?: string;
  is_public?: boolean;
  performance_score?: number;
  category_slug?: string;
  category_name?: string;
  is_verified?: boolean;
  membership?: Membership;
  custom_fields?: Record<string, string>;
  portfolio?: PortfolioItem[];
  created_at?: string;
  updated_at?: string;
}

export interface SearchResult {
  id: string;
  full_name: string;
  professional_name?: string;
  country?: string;
  city?: string;
  profile_photo_url?: string;
  availability?: string;
  custom_url?: string;
  membership: Membership;
  is_verified: boolean;
  category_slug?: string;
  category_name?: string;
  bio?: string;
}

export interface Paginated<T> {
  data: T[];
  pagination: {
    page: number;
    limit: number;
    total: number;
    totalPages: number;
  };
}

export interface HeroSlide {
  title: string;
  subtitle?: string;
  image?: string;
  ctaLabel?: string;
  ctaUrl?: string;
}

export interface ThemeSettings {
  id: string;
  name: string;
  is_active: boolean;
  primary_color: string;
  secondary_color: string;
  accent_color: string;
  background_color: string;
  text_color: string;
  button_color: string;
  button_text_color: string;
  gradient_from: string;
  gradient_to: string;
  verified_badge_color: string;
  updated_at?: string;
}

export interface Section {
  id: string;
  key: string;
  title?: string;
  subtitle?: string;
  content?: any;
  media_url?: string;
  cta_label?: string;
  cta_url?: string;
  sort_order: number;
  is_visible: boolean;
  updated_at?: string;
}

export interface Page {
  id: string;
  slug: string;
  title: string;
  meta_title?: string;
  meta_description?: string;
  og_image?: string;
  is_published: boolean;
  sections: Section[];
  created_at?: string;
  updated_at?: string;
}

export interface MediaItem {
  id: string;
  filename: string;
  original_name: string;
  mime_type: string;
  size_bytes: number;
  url: string;
  folder: string;
  alt_text?: string;
  uploaded_by?: string;
  created_at?: string;
}

export interface ContactMessage {
  id: string;
  name: string;
  email: string;
  subject?: string;
  message: string;
  status: 'new' | 'read' | 'replied' | 'archived';
  admin_notes?: string;
  created_at: string;
  updated_at?: string;
}

export interface Announcement {
  id: string;
  title: string;
  announcement_type: string;
  description?: string;
  budget?: number;
  is_paid: boolean;
  location?: string;
  deadline?: string;
  people_needed: number;
  moodboard_urls?: string[];
  status: 'pending' | 'approved' | 'rejected' | 'closed';
  required_category_slug?: string;
  required_category_name?: string;
  author_name?: string;
  author_professional_name?: string;
  author_photo?: string;
  author_id?: string;
  created_at: string;
}

export interface AnnouncementApplication {
  id: string;
  announcement_id: string;
  applicant_id: string;
  message?: string;
  full_name?: string;
  professional_name?: string;
  profile_photo_url?: string;
  category_name?: string;
  created_at: string;
}

export interface EventItem {
  id: string;
  title: string;
  slug: string;
  description?: string;
  event_type: string;
  cover_image?: string;
  starts_at?: string;
  ends_at?: string;
  prize?: string;
  is_published?: boolean;
  created_at: string;
}

export interface LearningArticle {
  id: string;
  title: string;
  slug: string;
  category?: string;
  content?: string;
  cover_image?: string;
  video_url?: string;
  is_published?: boolean;
  created_at: string;
  updated_at?: string;
}

export type BookingStatus =
  | 'pending' | 'accepted' | 'negotiating' | 'in_progress'
  | 'completed' | 'cancelled' | 'reviewed';

export interface Booking {
  id: string;
  client_id: string;
  creative_id: string;
  project_type?: string;
  project_date?: string;
  project_time?: string;
  duration_hours?: number | string;
  location?: string;
  description?: string;
  moodboard_urls?: string[];
  budget?: number;
  quoted_price?: number;
  status: BookingStatus;
  client_name?: string;
  creative_name?: string;
  client_professional_name?: string;
  creative_professional_name?: string;
  client_photo?: string;
  creative_photo?: string;
  client_email?: string;
  creative_email?: string;
  client_phone?: string;
  creative_phone?: string;
  conversationId?: string;
  created_at: string;
  updated_at?: string;
}

export interface ConversationParticipant {
  id: string;
  full_name: string;
  professional_name?: string;
  profile_photo_url?: string;
}

export interface Conversation {
  id: string;
  booking_id?: string;
  booking_status?: BookingStatus;
  project_type?: string;
  booking_date?: string;
  booking_time?: string;
  booking_location?: string;
  booking_hours?: number | string;
  unread_count: number;
  last_message?: string;
  last_message_at?: string;
  participants: ConversationParticipant[];
  created_at: string;
}

export interface Message {
  id: string;
  conversation_id: string;
  sender_id: string;
  sender_name?: string;
  sender_photo?: string;
  body: string;
  is_saved?: boolean;
  read_at?: string | null;
  created_at: string;
}

export interface DashboardAlerts {
  unreadMessages: number;
  newBookings: number;
  bookingUpdates: number;
  subscription?: SubscriptionInfo | null;
}

export interface DashboardSummary {
  profile: {
    id: string;
    full_name: string;
    professional_name?: string;
    profile_photo_url?: string;
    is_public: boolean;
    performance_score: number;
  } | null;
  bookings: { pending: number; active: number; completed: number; total: number };
  messages: { unread: number };
  analytics: { views_7d: number; views_30d: number };
  notifications: { unread: number };
  alerts?: DashboardAlerts;
  subscription?: SubscriptionInfo | null;
  payment?: WhishPaymentInstructions | null;
  recentBookings: Array<{
    id: string;
    project_type?: string;
    project_date?: string;
    status: BookingStatus;
    created_at: string;
    counterpart_name?: string;
  }>;
}

export interface AdminAnalytics {
  visitors: { last_24h: number; last_7d: number; last_30d: number; unique_visitors_30d: number };
  contacts: { new_count: number; total: number };
  popularPages: Array<{ path: string; views: number }>;
  recentActivity: Array<{
    id: string;
    event_type: string;
    path?: string;
    metadata?: any;
    created_at: string;
    user_email?: string;
    profile_name?: string;
  }>;
  profiles: {
    active: number;
    total: number;
    pending: number;
    premium: number;
    monthlyAmount: number;
    activeMemberships: number;
    pendingPayments?: number;
  };
  topProfiles: Array<{
    id: string;
    professional_name?: string;
    full_name?: string;
    profile_photo_url?: string;
    custom_url?: string;
    category_name?: string;
    views: number;
  }>;
}

export interface PriceEstimate {
  estimate: { min: number; max: number; currency: string };
  breakdown: {
    categorySlug: string;
    baseRange: { min: number; max: number };
    multipliers: Record<string, number>;
  };
  disclaimer: string;
}

export interface ApiError {
  error: string;
}
