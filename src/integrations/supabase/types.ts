export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[]

export type Database = {
  // Allows to automatically instantiate createClient with right options
  // instead of createClient<Database, { PostgrestVersion: 'XX' }>(URL, KEY)
  __InternalSupabase: {
    PostgrestVersion: "14.5"
  }
  public: {
    Tables: {
      audit_logs: {
        Row: {
          action: string
          actor_id: string | null
          business_id: string | null
          created_at: string
          entity: string | null
          entity_id: string | null
          id: string
          meta: Json
        }
        Insert: {
          action: string
          actor_id?: string | null
          business_id?: string | null
          created_at?: string
          entity?: string | null
          entity_id?: string | null
          id?: string
          meta?: Json
        }
        Update: {
          action?: string
          actor_id?: string | null
          business_id?: string | null
          created_at?: string
          entity?: string | null
          entity_id?: string | null
          id?: string
          meta?: Json
        }
        Relationships: [
          {
            foreignKeyName: "audit_logs_business_id_fkey"
            columns: ["business_id"]
            isOneToOne: false
            referencedRelation: "businesses"
            referencedColumns: ["id"]
          },
        ]
      }
      branches: {
        Row: {
          address: string | null
          business_id: string
          closing_time: string | null
          created_at: string
          id: string
          is_active: boolean
          latitude: number | null
          longitude: number | null
          name: string
          opening_time: string | null
          phone: string | null
        }
        Insert: {
          address?: string | null
          business_id: string
          closing_time?: string | null
          created_at?: string
          id?: string
          is_active?: boolean
          latitude?: number | null
          longitude?: number | null
          name: string
          opening_time?: string | null
          phone?: string | null
        }
        Update: {
          address?: string | null
          business_id?: string
          closing_time?: string | null
          created_at?: string
          id?: string
          is_active?: boolean
          latitude?: number | null
          longitude?: number | null
          name?: string
          opening_time?: string | null
          phone?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "branches_business_id_fkey"
            columns: ["business_id"]
            isOneToOne: false
            referencedRelation: "businesses"
            referencedColumns: ["id"]
          },
        ]
      }
      business_staff: {
        Row: {
          branch_id: string | null
          business_id: string
          created_at: string
          email: string | null
          full_name: string
          id: string
          is_active: boolean
          phone: string | null
          role: Database["public"]["Enums"]["staff_role"]
          user_id: string | null
        }
        Insert: {
          branch_id?: string | null
          business_id: string
          created_at?: string
          email?: string | null
          full_name: string
          id?: string
          is_active?: boolean
          phone?: string | null
          role?: Database["public"]["Enums"]["staff_role"]
          user_id?: string | null
        }
        Update: {
          branch_id?: string | null
          business_id?: string
          created_at?: string
          email?: string | null
          full_name?: string
          id?: string
          is_active?: boolean
          phone?: string | null
          role?: Database["public"]["Enums"]["staff_role"]
          user_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "business_staff_business_id_fkey"
            columns: ["business_id"]
            isOneToOne: false
            referencedRelation: "businesses"
            referencedColumns: ["id"]
          },
        ]
      }
      businesses: {
        Row: {
          address: string | null
          category: string | null
          city: string | null
          created_at: string
          daily_stamp_limit: number
          email: string | null
          google_review_url: string | null
          id: string
          instagram_url: string | null
          location_validation: boolean
          logo_url: string | null
          name: string
          onboarding_completed: boolean
          owner_id: string
          phone: string | null
          pincode: string | null
          slug: string
          stamp_cooldown_minutes: number
          stamp_mode: string
          state: string | null
          status: Database["public"]["Enums"]["business_status"]
          updated_at: string
          website: string | null
          whatsapp_number: string | null
        }
        Insert: {
          address?: string | null
          category?: string | null
          city?: string | null
          created_at?: string
          daily_stamp_limit?: number
          email?: string | null
          google_review_url?: string | null
          id?: string
          instagram_url?: string | null
          location_validation?: boolean
          logo_url?: string | null
          name: string
          onboarding_completed?: boolean
          owner_id: string
          phone?: string | null
          pincode?: string | null
          slug: string
          stamp_cooldown_minutes?: number
          stamp_mode?: string
          state?: string | null
          status?: Database["public"]["Enums"]["business_status"]
          updated_at?: string
          website?: string | null
          whatsapp_number?: string | null
        }
        Update: {
          address?: string | null
          category?: string | null
          city?: string | null
          created_at?: string
          daily_stamp_limit?: number
          email?: string | null
          google_review_url?: string | null
          id?: string
          instagram_url?: string | null
          location_validation?: boolean
          logo_url?: string | null
          name?: string
          onboarding_completed?: boolean
          owner_id?: string
          phone?: string | null
          pincode?: string | null
          slug?: string
          stamp_cooldown_minutes?: number
          stamp_mode?: string
          state?: string | null
          status?: Database["public"]["Enums"]["business_status"]
          updated_at?: string
          website?: string | null
          whatsapp_number?: string | null
        }
        Relationships: []
      }
      campaigns: {
        Row: {
          audience: Database["public"]["Enums"]["audience_type"]
          business_id: string
          channel: string
          created_at: string
          id: string
          is_active: boolean
          last_run_at: string | null
          message: string | null
          name: string
          type: string
        }
        Insert: {
          audience?: Database["public"]["Enums"]["audience_type"]
          business_id: string
          channel?: string
          created_at?: string
          id?: string
          is_active?: boolean
          last_run_at?: string | null
          message?: string | null
          name: string
          type?: string
        }
        Update: {
          audience?: Database["public"]["Enums"]["audience_type"]
          business_id?: string
          channel?: string
          created_at?: string
          id?: string
          is_active?: boolean
          last_run_at?: string | null
          message?: string | null
          name?: string
          type?: string
        }
        Relationships: [
          {
            foreignKeyName: "campaigns_business_id_fkey"
            columns: ["business_id"]
            isOneToOne: false
            referencedRelation: "businesses"
            referencedColumns: ["id"]
          },
        ]
      }
      customer_push_tokens: {
        Row: {
          business_id: string
          created_at: string
          customer_id: string
          id: string
          is_active: boolean
          last_seen_at: string
          platform: string
          token: string
        }
        Insert: {
          business_id: string
          created_at?: string
          customer_id: string
          id?: string
          is_active?: boolean
          last_seen_at?: string
          platform?: string
          token: string
        }
        Update: {
          business_id?: string
          created_at?: string
          customer_id?: string
          id?: string
          is_active?: boolean
          last_seen_at?: string
          platform?: string
          token?: string
        }
        Relationships: [
          {
            foreignKeyName: "customer_push_tokens_business_id_fkey"
            columns: ["business_id"]
            isOneToOne: false
            referencedRelation: "businesses"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "customer_push_tokens_customer_id_fkey"
            columns: ["customer_id"]
            isOneToOne: false
            referencedRelation: "customers"
            referencedColumns: ["id"]
          },
        ]
      }
      customers: {
        Row: {
          access_token: string
          anniversary: string | null
          branch_id: string | null
          business_id: string
          created_at: string
          dob: string | null
          email: string | null
          full_name: string
          id: string
          is_vip: boolean
          last_visit_at: string | null
          marketing_consent: boolean
          phone: string
          total_visits: number
          user_id: string | null
        }
        Insert: {
          access_token?: string
          anniversary?: string | null
          branch_id?: string | null
          business_id: string
          created_at?: string
          dob?: string | null
          email?: string | null
          full_name: string
          id?: string
          is_vip?: boolean
          last_visit_at?: string | null
          marketing_consent?: boolean
          phone: string
          total_visits?: number
          user_id?: string | null
        }
        Update: {
          access_token?: string
          anniversary?: string | null
          branch_id?: string | null
          business_id?: string
          created_at?: string
          dob?: string | null
          email?: string | null
          full_name?: string
          id?: string
          is_vip?: boolean
          last_visit_at?: string | null
          marketing_consent?: boolean
          phone?: string
          total_visits?: number
          user_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "customers_branch_id_fkey"
            columns: ["branch_id"]
            isOneToOne: false
            referencedRelation: "branches"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "customers_business_id_fkey"
            columns: ["business_id"]
            isOneToOne: false
            referencedRelation: "businesses"
            referencedColumns: ["id"]
          },
        ]
      }
      feedback: {
        Row: {
          branch_id: string | null
          business_id: string
          comment: string | null
          created_at: string
          customer_id: string | null
          id: string
          rating: number
        }
        Insert: {
          branch_id?: string | null
          business_id: string
          comment?: string | null
          created_at?: string
          customer_id?: string | null
          id?: string
          rating: number
        }
        Update: {
          branch_id?: string | null
          business_id?: string
          comment?: string | null
          created_at?: string
          customer_id?: string | null
          id?: string
          rating?: number
        }
        Relationships: [
          {
            foreignKeyName: "feedback_branch_id_fkey"
            columns: ["branch_id"]
            isOneToOne: false
            referencedRelation: "branches"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "feedback_business_id_fkey"
            columns: ["business_id"]
            isOneToOne: false
            referencedRelation: "businesses"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "feedback_customer_id_fkey"
            columns: ["customer_id"]
            isOneToOne: false
            referencedRelation: "customers"
            referencedColumns: ["id"]
          },
        ]
      }
      loyalty_cards: {
        Row: {
          business_id: string
          created_at: string
          customer_id: string
          cycles_completed: number
          id: string
          program_id: string
          stamps: number
          updated_at: string
        }
        Insert: {
          business_id: string
          created_at?: string
          customer_id: string
          cycles_completed?: number
          id?: string
          program_id: string
          stamps?: number
          updated_at?: string
        }
        Update: {
          business_id?: string
          created_at?: string
          customer_id?: string
          cycles_completed?: number
          id?: string
          program_id?: string
          stamps?: number
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "loyalty_cards_business_id_fkey"
            columns: ["business_id"]
            isOneToOne: false
            referencedRelation: "businesses"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "loyalty_cards_customer_id_fkey"
            columns: ["customer_id"]
            isOneToOne: false
            referencedRelation: "customers"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "loyalty_cards_program_id_fkey"
            columns: ["program_id"]
            isOneToOne: false
            referencedRelation: "loyalty_programs"
            referencedColumns: ["id"]
          },
        ]
      }
      loyalty_programs: {
        Row: {
          business_id: string
          created_at: string
          id: string
          is_active: boolean
          name: string
          reward_description: string
          reward_expiry_days: number
          reward_type: string
          stamps_required: number
        }
        Insert: {
          business_id: string
          created_at?: string
          id?: string
          is_active?: boolean
          name: string
          reward_description: string
          reward_expiry_days?: number
          reward_type?: string
          stamps_required?: number
        }
        Update: {
          business_id?: string
          created_at?: string
          id?: string
          is_active?: boolean
          name?: string
          reward_description?: string
          reward_expiry_days?: number
          reward_type?: string
          stamps_required?: number
        }
        Relationships: [
          {
            foreignKeyName: "loyalty_programs_business_id_fkey"
            columns: ["business_id"]
            isOneToOne: false
            referencedRelation: "businesses"
            referencedColumns: ["id"]
          },
        ]
      }
      menu_categories: {
        Row: {
          business_id: string
          created_at: string
          id: string
          name: string
          sort_order: number
        }
        Insert: {
          business_id: string
          created_at?: string
          id?: string
          name: string
          sort_order?: number
        }
        Update: {
          business_id?: string
          created_at?: string
          id?: string
          name?: string
          sort_order?: number
        }
        Relationships: [
          {
            foreignKeyName: "menu_categories_business_id_fkey"
            columns: ["business_id"]
            isOneToOne: false
            referencedRelation: "businesses"
            referencedColumns: ["id"]
          },
        ]
      }
      menu_items: {
        Row: {
          business_id: string
          category_id: string
          created_at: string
          description: string | null
          id: string
          image_url: string | null
          is_available: boolean
          name: string
          price: number
          sort_order: number
        }
        Insert: {
          business_id: string
          category_id: string
          created_at?: string
          description?: string | null
          id?: string
          image_url?: string | null
          is_available?: boolean
          name: string
          price?: number
          sort_order?: number
        }
        Update: {
          business_id?: string
          category_id?: string
          created_at?: string
          description?: string | null
          id?: string
          image_url?: string | null
          is_available?: boolean
          name?: string
          price?: number
          sort_order?: number
        }
        Relationships: [
          {
            foreignKeyName: "menu_items_business_id_fkey"
            columns: ["business_id"]
            isOneToOne: false
            referencedRelation: "businesses"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "menu_items_category_id_fkey"
            columns: ["category_id"]
            isOneToOne: false
            referencedRelation: "menu_categories"
            referencedColumns: ["id"]
          },
        ]
      }
      notification_logs: {
        Row: {
          business_id: string
          campaign_id: string | null
          channel: string
          created_at: string
          customer_id: string | null
          event: string
          id: string
          payload: Json
          provider: string
          status: string
        }
        Insert: {
          business_id: string
          campaign_id?: string | null
          channel?: string
          created_at?: string
          customer_id?: string | null
          event: string
          id?: string
          payload?: Json
          provider?: string
          status?: string
        }
        Update: {
          business_id?: string
          campaign_id?: string | null
          channel?: string
          created_at?: string
          customer_id?: string | null
          event?: string
          id?: string
          payload?: Json
          provider?: string
          status?: string
        }
        Relationships: [
          {
            foreignKeyName: "notification_logs_business_id_fkey"
            columns: ["business_id"]
            isOneToOne: false
            referencedRelation: "businesses"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "notification_logs_campaign_id_fkey"
            columns: ["campaign_id"]
            isOneToOne: false
            referencedRelation: "campaigns"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "notification_logs_customer_id_fkey"
            columns: ["customer_id"]
            isOneToOne: false
            referencedRelation: "customers"
            referencedColumns: ["id"]
          },
        ]
      }
      offer_redemptions: {
        Row: {
          business_id: string
          created_at: string
          customer_id: string
          id: string
          offer_id: string
        }
        Insert: {
          business_id: string
          created_at?: string
          customer_id: string
          id?: string
          offer_id: string
        }
        Update: {
          business_id?: string
          created_at?: string
          customer_id?: string
          id?: string
          offer_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "offer_redemptions_business_id_fkey"
            columns: ["business_id"]
            isOneToOne: false
            referencedRelation: "businesses"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "offer_redemptions_customer_id_fkey"
            columns: ["customer_id"]
            isOneToOne: false
            referencedRelation: "customers"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "offer_redemptions_offer_id_fkey"
            columns: ["offer_id"]
            isOneToOne: false
            referencedRelation: "offers"
            referencedColumns: ["id"]
          },
        ]
      }
      offers: {
        Row: {
          audience: Database["public"]["Enums"]["audience_type"]
          branch_id: string | null
          business_id: string
          created_at: string
          description: string | null
          discount_value: number | null
          ends_at: string | null
          id: string
          image_url: string | null
          is_active: boolean
          offer_type: Database["public"]["Enums"]["offer_type"]
          starts_at: string | null
          title: string
          usage_limit: number | null
        }
        Insert: {
          audience?: Database["public"]["Enums"]["audience_type"]
          branch_id?: string | null
          business_id: string
          created_at?: string
          description?: string | null
          discount_value?: number | null
          ends_at?: string | null
          id?: string
          image_url?: string | null
          is_active?: boolean
          offer_type?: Database["public"]["Enums"]["offer_type"]
          starts_at?: string | null
          title: string
          usage_limit?: number | null
        }
        Update: {
          audience?: Database["public"]["Enums"]["audience_type"]
          branch_id?: string | null
          business_id?: string
          created_at?: string
          description?: string | null
          discount_value?: number | null
          ends_at?: string | null
          id?: string
          image_url?: string | null
          is_active?: boolean
          offer_type?: Database["public"]["Enums"]["offer_type"]
          starts_at?: string | null
          title?: string
          usage_limit?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "offers_branch_id_fkey"
            columns: ["branch_id"]
            isOneToOne: false
            referencedRelation: "branches"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "offers_business_id_fkey"
            columns: ["business_id"]
            isOneToOne: false
            referencedRelation: "businesses"
            referencedColumns: ["id"]
          },
        ]
      }
      payments: {
        Row: {
          amount: number
          business_id: string
          created_at: string
          currency: string
          id: string
          invoice_number: string | null
          provider: string
          provider_ref: string | null
          status: string
          subscription_id: string | null
        }
        Insert: {
          amount: number
          business_id: string
          created_at?: string
          currency?: string
          id?: string
          invoice_number?: string | null
          provider?: string
          provider_ref?: string | null
          status?: string
          subscription_id?: string | null
        }
        Update: {
          amount?: number
          business_id?: string
          created_at?: string
          currency?: string
          id?: string
          invoice_number?: string | null
          provider?: string
          provider_ref?: string | null
          status?: string
          subscription_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "payments_business_id_fkey"
            columns: ["business_id"]
            isOneToOne: false
            referencedRelation: "businesses"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "payments_subscription_id_fkey"
            columns: ["subscription_id"]
            isOneToOne: false
            referencedRelation: "subscriptions"
            referencedColumns: ["id"]
          },
        ]
      }
      plans: {
        Row: {
          code: string
          created_at: string
          features: Json
          id: string
          is_active: boolean
          max_branches: number
          name: string
          price_monthly: number
          price_yearly: number
          sort_order: number
        }
        Insert: {
          code: string
          created_at?: string
          features?: Json
          id?: string
          is_active?: boolean
          max_branches?: number
          name: string
          price_monthly?: number
          price_yearly?: number
          sort_order?: number
        }
        Update: {
          code?: string
          created_at?: string
          features?: Json
          id?: string
          is_active?: boolean
          max_branches?: number
          name?: string
          price_monthly?: number
          price_yearly?: number
          sort_order?: number
        }
        Relationships: []
      }
      profiles: {
        Row: {
          avatar_url: string | null
          created_at: string
          email: string | null
          full_name: string | null
          id: string
          mobile: string | null
          updated_at: string
        }
        Insert: {
          avatar_url?: string | null
          created_at?: string
          email?: string | null
          full_name?: string | null
          id: string
          mobile?: string | null
          updated_at?: string
        }
        Update: {
          avatar_url?: string | null
          created_at?: string
          email?: string | null
          full_name?: string | null
          id?: string
          mobile?: string | null
          updated_at?: string
        }
        Relationships: []
      }
      qr_codes: {
        Row: {
          branch_id: string | null
          business_id: string
          created_at: string
          id: string
          is_active: boolean
          label: string
          qr_type: Database["public"]["Enums"]["qr_type"]
          scan_count: number
          token: string
        }
        Insert: {
          branch_id?: string | null
          business_id: string
          created_at?: string
          id?: string
          is_active?: boolean
          label: string
          qr_type?: Database["public"]["Enums"]["qr_type"]
          scan_count?: number
          token?: string
        }
        Update: {
          branch_id?: string | null
          business_id?: string
          created_at?: string
          id?: string
          is_active?: boolean
          label?: string
          qr_type?: Database["public"]["Enums"]["qr_type"]
          scan_count?: number
          token?: string
        }
        Relationships: [
          {
            foreignKeyName: "qr_codes_branch_id_fkey"
            columns: ["branch_id"]
            isOneToOne: false
            referencedRelation: "branches"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "qr_codes_business_id_fkey"
            columns: ["business_id"]
            isOneToOne: false
            referencedRelation: "businesses"
            referencedColumns: ["id"]
          },
        ]
      }
      qr_scans: {
        Row: {
          branch_id: string | null
          business_id: string
          created_at: string
          customer_id: string | null
          id: string
          qr_id: string | null
        }
        Insert: {
          branch_id?: string | null
          business_id: string
          created_at?: string
          customer_id?: string | null
          id?: string
          qr_id?: string | null
        }
        Update: {
          branch_id?: string | null
          business_id?: string
          created_at?: string
          customer_id?: string | null
          id?: string
          qr_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "qr_scans_branch_id_fkey"
            columns: ["branch_id"]
            isOneToOne: false
            referencedRelation: "branches"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "qr_scans_business_id_fkey"
            columns: ["business_id"]
            isOneToOne: false
            referencedRelation: "businesses"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "qr_scans_customer_id_fkey"
            columns: ["customer_id"]
            isOneToOne: false
            referencedRelation: "customers"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "qr_scans_qr_id_fkey"
            columns: ["qr_id"]
            isOneToOne: false
            referencedRelation: "qr_codes"
            referencedColumns: ["id"]
          },
        ]
      }
      rewards: {
        Row: {
          business_id: string
          code: string
          created_at: string
          customer_id: string
          description: string
          expires_at: string | null
          id: string
          program_id: string | null
          redeemed_at: string | null
          redeemed_by: string | null
          source: string
          status: Database["public"]["Enums"]["reward_status"]
        }
        Insert: {
          business_id: string
          code?: string
          created_at?: string
          customer_id: string
          description: string
          expires_at?: string | null
          id?: string
          program_id?: string | null
          redeemed_at?: string | null
          redeemed_by?: string | null
          source?: string
          status?: Database["public"]["Enums"]["reward_status"]
        }
        Update: {
          business_id?: string
          code?: string
          created_at?: string
          customer_id?: string
          description?: string
          expires_at?: string | null
          id?: string
          program_id?: string | null
          redeemed_at?: string | null
          redeemed_by?: string | null
          source?: string
          status?: Database["public"]["Enums"]["reward_status"]
        }
        Relationships: [
          {
            foreignKeyName: "rewards_business_id_fkey"
            columns: ["business_id"]
            isOneToOne: false
            referencedRelation: "businesses"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "rewards_customer_id_fkey"
            columns: ["customer_id"]
            isOneToOne: false
            referencedRelation: "customers"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "rewards_program_id_fkey"
            columns: ["program_id"]
            isOneToOne: false
            referencedRelation: "loyalty_programs"
            referencedColumns: ["id"]
          },
        ]
      }
      scratch_campaigns: {
        Row: {
          business_id: string
          created_at: string
          ends_at: string | null
          id: string
          is_active: boolean
          name: string
          starts_at: string | null
          trigger: string
        }
        Insert: {
          business_id: string
          created_at?: string
          ends_at?: string | null
          id?: string
          is_active?: boolean
          name: string
          starts_at?: string | null
          trigger?: string
        }
        Update: {
          business_id?: string
          created_at?: string
          ends_at?: string | null
          id?: string
          is_active?: boolean
          name?: string
          starts_at?: string | null
          trigger?: string
        }
        Relationships: [
          {
            foreignKeyName: "scratch_campaigns_business_id_fkey"
            columns: ["business_id"]
            isOneToOne: false
            referencedRelation: "businesses"
            referencedColumns: ["id"]
          },
        ]
      }
      scratch_prizes: {
        Row: {
          business_id: string
          campaign_id: string
          created_at: string
          expiry_days: number
          id: string
          is_win: boolean
          label: string
          probability: number
          reward_description: string | null
        }
        Insert: {
          business_id: string
          campaign_id: string
          created_at?: string
          expiry_days?: number
          id?: string
          is_win?: boolean
          label: string
          probability?: number
          reward_description?: string | null
        }
        Update: {
          business_id?: string
          campaign_id?: string
          created_at?: string
          expiry_days?: number
          id?: string
          is_win?: boolean
          label?: string
          probability?: number
          reward_description?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "scratch_prizes_business_id_fkey"
            columns: ["business_id"]
            isOneToOne: false
            referencedRelation: "businesses"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "scratch_prizes_campaign_id_fkey"
            columns: ["campaign_id"]
            isOneToOne: false
            referencedRelation: "scratch_campaigns"
            referencedColumns: ["id"]
          },
        ]
      }
      scratch_wins: {
        Row: {
          business_id: string
          campaign_id: string
          created_at: string
          customer_id: string
          id: string
          prize_id: string | null
          reward_id: string | null
        }
        Insert: {
          business_id: string
          campaign_id: string
          created_at?: string
          customer_id: string
          id?: string
          prize_id?: string | null
          reward_id?: string | null
        }
        Update: {
          business_id?: string
          campaign_id?: string
          created_at?: string
          customer_id?: string
          id?: string
          prize_id?: string | null
          reward_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "scratch_wins_business_id_fkey"
            columns: ["business_id"]
            isOneToOne: false
            referencedRelation: "businesses"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "scratch_wins_campaign_id_fkey"
            columns: ["campaign_id"]
            isOneToOne: false
            referencedRelation: "scratch_campaigns"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "scratch_wins_customer_id_fkey"
            columns: ["customer_id"]
            isOneToOne: false
            referencedRelation: "customers"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "scratch_wins_prize_id_fkey"
            columns: ["prize_id"]
            isOneToOne: false
            referencedRelation: "scratch_prizes"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "scratch_wins_reward_id_fkey"
            columns: ["reward_id"]
            isOneToOne: false
            referencedRelation: "rewards"
            referencedColumns: ["id"]
          },
        ]
      }
      stamp_events: {
        Row: {
          branch_id: string | null
          business_id: string
          card_id: string
          created_at: string
          customer_id: string
          id: string
          issued_by: string | null
          source: string
        }
        Insert: {
          branch_id?: string | null
          business_id: string
          card_id: string
          created_at?: string
          customer_id: string
          id?: string
          issued_by?: string | null
          source?: string
        }
        Update: {
          branch_id?: string | null
          business_id?: string
          card_id?: string
          created_at?: string
          customer_id?: string
          id?: string
          issued_by?: string | null
          source?: string
        }
        Relationships: [
          {
            foreignKeyName: "stamp_events_branch_id_fkey"
            columns: ["branch_id"]
            isOneToOne: false
            referencedRelation: "branches"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "stamp_events_business_id_fkey"
            columns: ["business_id"]
            isOneToOne: false
            referencedRelation: "businesses"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "stamp_events_card_id_fkey"
            columns: ["card_id"]
            isOneToOne: false
            referencedRelation: "loyalty_cards"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "stamp_events_customer_id_fkey"
            columns: ["customer_id"]
            isOneToOne: false
            referencedRelation: "customers"
            referencedColumns: ["id"]
          },
        ]
      }
      subscriptions: {
        Row: {
          business_id: string
          created_at: string
          current_period_end: string | null
          id: string
          plan_id: string
          provider: string | null
          status: Database["public"]["Enums"]["sub_status"]
          trial_ends_at: string | null
          updated_at: string
        }
        Insert: {
          business_id: string
          created_at?: string
          current_period_end?: string | null
          id?: string
          plan_id: string
          provider?: string | null
          status?: Database["public"]["Enums"]["sub_status"]
          trial_ends_at?: string | null
          updated_at?: string
        }
        Update: {
          business_id?: string
          created_at?: string
          current_period_end?: string | null
          id?: string
          plan_id?: string
          provider?: string | null
          status?: Database["public"]["Enums"]["sub_status"]
          trial_ends_at?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "subscriptions_business_id_fkey"
            columns: ["business_id"]
            isOneToOne: false
            referencedRelation: "businesses"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "subscriptions_plan_id_fkey"
            columns: ["plan_id"]
            isOneToOne: false
            referencedRelation: "plans"
            referencedColumns: ["id"]
          },
        ]
      }
      support_tickets: {
        Row: {
          admin_reply: string | null
          business_id: string | null
          created_at: string
          created_by: string | null
          id: string
          message: string
          priority: string
          status: string
          subject: string
        }
        Insert: {
          admin_reply?: string | null
          business_id?: string | null
          created_at?: string
          created_by?: string | null
          id?: string
          message: string
          priority?: string
          status?: string
          subject: string
        }
        Update: {
          admin_reply?: string | null
          business_id?: string | null
          created_at?: string
          created_by?: string | null
          id?: string
          message?: string
          priority?: string
          status?: string
          subject?: string
        }
        Relationships: [
          {
            foreignKeyName: "support_tickets_business_id_fkey"
            columns: ["business_id"]
            isOneToOne: false
            referencedRelation: "businesses"
            referencedColumns: ["id"]
          },
        ]
      }
      user_roles: {
        Row: {
          created_at: string
          id: string
          role: Database["public"]["Enums"]["platform_role"]
          user_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          role: Database["public"]["Enums"]["platform_role"]
          user_id: string
        }
        Update: {
          created_at?: string
          id?: string
          role?: Database["public"]["Enums"]["platform_role"]
          user_id?: string
        }
        Relationships: []
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      has_role: {
        Args: {
          _role: Database["public"]["Enums"]["platform_role"]
          _user_id: string
        }
        Returns: boolean
      }
      is_business_admin: { Args: { _business_id: string }; Returns: boolean }
      is_business_member: { Args: { _business_id: string }; Returns: boolean }
      is_super_admin: { Args: never; Returns: boolean }
      security_policy_report: {
        Args: never
        Returns: {
          check_expression: string
          command: string
          policy_name: string
          roles: string
          table_name: string
          using_expression: string
        }[]
      }
      security_table_report: {
        Args: never
        Returns: {
          anon_privs: string
          authenticated_privs: string
          has_business_id: boolean
          policy_count: number
          rls_enabled: boolean
          table_name: string
        }[]
      }
    }
    Enums: {
      audience_type: "ALL" | "NEW" | "REPEAT" | "INACTIVE" | "VIP"
      business_status: "ACTIVE" | "SUSPENDED" | "PENDING"
      offer_type: "PERCENT" | "FLAT" | "BOGO" | "FREE_PRODUCT" | "CUSTOM"
      platform_role:
        | "SUPER_ADMIN"
        | "BUSINESS_OWNER"
        | "BUSINESS_MANAGER"
        | "STAFF"
        | "CUSTOMER"
      qr_type: "BUSINESS" | "BRANCH" | "CAMPAIGN" | "MENU" | "LOYALTY"
      reward_status: "AVAILABLE" | "REDEEMED" | "EXPIRED" | "CANCELLED"
      staff_role: "BUSINESS_OWNER" | "BUSINESS_MANAGER" | "STAFF"
      sub_status: "TRIAL" | "ACTIVE" | "PAST_DUE" | "CANCELLED" | "SUSPENDED"
    }
    CompositeTypes: {
      [_ in never]: never
    }
  }
}

type DatabaseWithoutInternals = Omit<Database, "__InternalSupabase">

type DefaultSchema = DatabaseWithoutInternals[Extract<keyof Database, "public">]

export type Tables<
  DefaultSchemaTableNameOrOptions extends
    | keyof (DefaultSchema["Tables"] & DefaultSchema["Views"])
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends (DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
        DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])
    : never) = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
      DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])[TableName] extends {
      Row: infer R
    }
    ? R
    : never
  : DefaultSchemaTableNameOrOptions extends keyof (DefaultSchema["Tables"] &
        DefaultSchema["Views"])
    ? (DefaultSchema["Tables"] &
        DefaultSchema["Views"])[DefaultSchemaTableNameOrOptions] extends {
        Row: infer R
      }
      ? R
      : never
    : never

export type TablesInsert<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema["Tables"]
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends (DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never) = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Insert: infer I
    }
    ? I
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Insert: infer I
      }
      ? I
      : never
    : never

export type TablesUpdate<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema["Tables"]
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends (DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never) = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Update: infer U
    }
    ? U
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Update: infer U
      }
      ? U
      : never
    : never

export type Enums<
  DefaultSchemaEnumNameOrOptions extends
    | keyof DefaultSchema["Enums"]
    | { schema: keyof DatabaseWithoutInternals },
  EnumName extends (DefaultSchemaEnumNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"]
    : never) = never,
> = DefaultSchemaEnumNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"][EnumName]
  : DefaultSchemaEnumNameOrOptions extends keyof DefaultSchema["Enums"]
    ? DefaultSchema["Enums"][DefaultSchemaEnumNameOrOptions]
    : never

export type CompositeTypes<
  PublicCompositeTypeNameOrOptions extends
    | keyof DefaultSchema["CompositeTypes"]
    | { schema: keyof DatabaseWithoutInternals },
  CompositeTypeName extends (PublicCompositeTypeNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"]
    : never) = never,
> = PublicCompositeTypeNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"][CompositeTypeName]
  : PublicCompositeTypeNameOrOptions extends keyof DefaultSchema["CompositeTypes"]
    ? DefaultSchema["CompositeTypes"][PublicCompositeTypeNameOrOptions]
    : never

export const Constants = {
  public: {
    Enums: {
      audience_type: ["ALL", "NEW", "REPEAT", "INACTIVE", "VIP"],
      business_status: ["ACTIVE", "SUSPENDED", "PENDING"],
      offer_type: ["PERCENT", "FLAT", "BOGO", "FREE_PRODUCT", "CUSTOM"],
      platform_role: [
        "SUPER_ADMIN",
        "BUSINESS_OWNER",
        "BUSINESS_MANAGER",
        "STAFF",
        "CUSTOMER",
      ],
      qr_type: ["BUSINESS", "BRANCH", "CAMPAIGN", "MENU", "LOYALTY"],
      reward_status: ["AVAILABLE", "REDEEMED", "EXPIRED", "CANCELLED"],
      staff_role: ["BUSINESS_OWNER", "BUSINESS_MANAGER", "STAFF"],
      sub_status: ["TRIAL", "ACTIVE", "PAST_DUE", "CANCELLED", "SUSPENDED"],
    },
  },
} as const
