export type Plan     = 'essence' | 'heritage' | 'diamond'
export type LinkStatus = 'draft' | 'active' | 'archived' | 'locked'
export type TxType   = 'one_time' | 'subscription_start' | 'subscription_renew' | 'subscription_cancel' | 'refund'
export type TxStatus = 'pending' | 'succeeded' | 'failed' | 'refunded'

export interface User {
  id:                    string
  created_at:            string
  updated_at:            string
  email:                 string
  full_name?:            string
  avatar_url?:           string
  plan:                  Plan
  plan_started_at?:      string
  plan_expires_at?:      string
  stripe_customer_id?:   string
  stripe_subscription_id?: string
  timezone:              string
  locale:                string
  is_active:             boolean
}

export interface Link {
  id:               string
  created_at:       string
  updated_at:       string
  user_id:          string
  slug:             string
  title:            string
  message:          string
  protocol:         string
  sender_name:      string
  recipient_name:   string
  recipient_email?: string
  audio_url?:       string
  audio_filename?:  string
  audio_duration_s?: number
  audio_waveform?:  number[]
  custom_bg?:       string
  video_url?:       string
  eco_trees:        number
  eco_kg_offset:    number
  eco_certificate?: string
  status:           LinkStatus
  is_private:       boolean
  access_code?:     string
  view_count:       number
  audio_play_count: number
  share_count:      number
  last_viewed_at?:  string
  expires_at?:      string
}

export interface Transaction {
  id:                      string
  created_at:              string
  user_id?:                string
  link_id?:                string
  type:                    TxType
  stripe_session_id?:      string
  stripe_payment_intent?:  string
  stripe_subscription_id?: string
  stripe_invoice_id?:      string
  amount_eur:              number
  currency:                string
  status:                  TxStatus
  plan:                    Plan
  stripe_price_id?:        string
  metadata?:               Record<string, unknown>
  failed_at?:              string
  refunded_at?:            string
}

export const PLAN_META: Record<Plan, {
  glyph:   string
  name:    string
  price:   number
  billing: string
  color:   string
  accent:  string
  priceId: string
}> = {
  essence: {
    glyph:   '◈',
    name:    'Essence',
    price:   19,
    billing: 'paiement unique',
    color:   'rgba(224,196,180,.06)',
    accent:  '#E0C4B4',
    priceId: process.env.STRIPE_PRICE_ESSENCE ?? '',
  },
  heritage: {
    glyph:   '✦',
    name:    'Héritage',
    price:   49,
    billing: 'paiement unique',
    color:   'rgba(6,57,39,.35)',
    accent:  '#E0C4B4',
    priceId: process.env.STRIPE_PRICE_HERITAGE ?? '',
  },
  diamond: {
    glyph:   '◉',
    name:    'Diamond',
    price:   9,
    billing: 'par mois',
    color:   'rgba(2,4,20,.8)',
    accent:  '#c4b0e8',
    priceId: process.env.STRIPE_PRICE_DIAMOND ?? '',
  },
}
