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
      admin_audit_log: {
        Row: {
          action: string
          actor_user_id: string | null
          actor_username: string | null
          created_at: string
          details: Json
          id: string
          ip_address: string | null
          target_user_id: string | null
          target_username: string | null
          user_agent: string | null
        }
        Insert: {
          action: string
          actor_user_id?: string | null
          actor_username?: string | null
          created_at?: string
          details?: Json
          id?: string
          ip_address?: string | null
          target_user_id?: string | null
          target_username?: string | null
          user_agent?: string | null
        }
        Update: {
          action?: string
          actor_user_id?: string | null
          actor_username?: string | null
          created_at?: string
          details?: Json
          id?: string
          ip_address?: string | null
          target_user_id?: string | null
          target_username?: string | null
          user_agent?: string | null
        }
        Relationships: []
      }
      analytics_daily_counts: {
        Row: {
          category_id: string | null
          content_id: string | null
          count: number
          event_type: string
          facility_value: string
          period_date: string
        }
        Insert: {
          category_id?: string | null
          content_id?: string | null
          count?: number
          event_type: string
          facility_value?: string
          period_date: string
        }
        Update: {
          category_id?: string | null
          content_id?: string | null
          count?: number
          event_type?: string
          facility_value?: string
          period_date?: string
        }
        Relationships: []
      }
      analytics_events: {
        Row: {
          category_id: string | null
          content_id: string | null
          created_at: string
          event_type: string
          id: string
          user_id: string | null
        }
        Insert: {
          category_id?: string | null
          content_id?: string | null
          created_at?: string
          event_type: string
          id?: string
          user_id?: string | null
        }
        Update: {
          category_id?: string | null
          content_id?: string | null
          created_at?: string
          event_type?: string
          id?: string
          user_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "analytics_events_category_id_fkey"
            columns: ["category_id"]
            isOneToOne: false
            referencedRelation: "categories"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "analytics_events_content_id_fkey"
            columns: ["content_id"]
            isOneToOne: false
            referencedRelation: "content_items"
            referencedColumns: ["id"]
          },
        ]
      }
      analytics_program_completion: {
        Row: {
          category_id: string | null
          completion_rate: number | null
          facility_value: string | null
          name: string | null
          total_items: number | null
          updated_at: string | null
          users_completed: number | null
          users_engaged: number | null
        }
        Insert: {
          category_id?: string | null
          completion_rate?: number | null
          facility_value?: string | null
          name?: string | null
          total_items?: number | null
          updated_at?: string | null
          users_completed?: number | null
          users_engaged?: number | null
        }
        Update: {
          category_id?: string | null
          completion_rate?: number | null
          facility_value?: string | null
          name?: string | null
          total_items?: number | null
          updated_at?: string | null
          users_completed?: number | null
          users_engaged?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "analytics_program_completion_category_id_fkey"
            columns: ["category_id"]
            isOneToOne: false
            referencedRelation: "categories"
            referencedColumns: ["id"]
          },
        ]
      }
      analytics_retention: {
        Row: {
          day30_rate: number | null
          day60_rate: number | null
          day7_rate: number | null
          facility_value: string | null
          total_users: number | null
          updated_at: string | null
        }
        Insert: {
          day30_rate?: number | null
          day60_rate?: number | null
          day7_rate?: number | null
          facility_value?: string | null
          total_users?: number | null
          updated_at?: string | null
        }
        Update: {
          day30_rate?: number | null
          day60_rate?: number | null
          day7_rate?: number | null
          facility_value?: string | null
          total_users?: number | null
          updated_at?: string | null
        }
        Relationships: []
      }
      analytics_weekly_growth: {
        Row: {
          active_users: number | null
          facility_value: string | null
          signups: number | null
          updated_at: string | null
          week_ending: string | null
        }
        Insert: {
          active_users?: number | null
          facility_value?: string | null
          signups?: number | null
          updated_at?: string | null
          week_ending?: string | null
        }
        Update: {
          active_users?: number | null
          facility_value?: string | null
          signups?: number | null
          updated_at?: string | null
          week_ending?: string | null
        }
        Relationships: []
      }
      categories: {
        Row: {
          created_at: string
          description: string
          description_es: string | null
          home_page_mode: string
          icon_color: string | null
          icon_name: string | null
          icon_url: string | null
          id: string
          name: string
          name_es: string | null
          published: boolean
          slug: string
          sort_order: number
          tagline: string
          tagline_es: string | null
          updated_at: string
        }
        Insert: {
          created_at?: string
          description?: string
          description_es?: string | null
          home_page_mode?: string
          icon_color?: string | null
          icon_name?: string | null
          icon_url?: string | null
          id?: string
          name: string
          name_es?: string | null
          published?: boolean
          slug: string
          sort_order?: number
          tagline?: string
          tagline_es?: string | null
          updated_at?: string
        }
        Update: {
          created_at?: string
          description?: string
          description_es?: string | null
          home_page_mode?: string
          icon_color?: string | null
          icon_name?: string | null
          icon_url?: string | null
          id?: string
          name?: string
          name_es?: string | null
          published?: boolean
          slug?: string
          sort_order?: number
          tagline?: string
          tagline_es?: string | null
          updated_at?: string
        }
        Relationships: []
      }
      category_facilities: {
        Row: {
          category_id: string
          facility_value: string
        }
        Insert: {
          category_id: string
          facility_value: string
        }
        Update: {
          category_id?: string
          facility_value?: string
        }
        Relationships: [
          {
            foreignKeyName: "category_facilities_category_id_fkey"
            columns: ["category_id"]
            isOneToOne: false
            referencedRelation: "categories"
            referencedColumns: ["id"]
          },
        ]
      }
      content_item_bookmark_totals: {
        Row: {
          bookmark_count: number
          content_item_id: string
          updated_at: string
        }
        Insert: {
          bookmark_count?: number
          content_item_id: string
          updated_at?: string
        }
        Update: {
          bookmark_count?: number
          content_item_id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "content_item_bookmark_totals_content_item_id_fkey"
            columns: ["content_item_id"]
            isOneToOne: true
            referencedRelation: "content_items"
            referencedColumns: ["id"]
          },
        ]
      }
      content_item_facilities: {
        Row: {
          content_item_id: string
          facility_value: string
        }
        Insert: {
          content_item_id: string
          facility_value: string
        }
        Update: {
          content_item_id?: string
          facility_value?: string
        }
        Relationships: [
          {
            foreignKeyName: "content_item_facilities_content_item_id_fkey"
            columns: ["content_item_id"]
            isOneToOne: false
            referencedRelation: "content_items"
            referencedColumns: ["id"]
          },
        ]
      }
      content_item_openers: {
        Row: {
          content_item_id: string
          opener_count: number | null
          updated_at: string | null
        }
        Insert: {
          content_item_id: string
          opener_count?: number | null
          updated_at?: string | null
        }
        Update: {
          content_item_id?: string
          opener_count?: number | null
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "content_item_openers_content_item_id_fkey"
            columns: ["content_item_id"]
            isOneToOne: true
            referencedRelation: "content_items"
            referencedColumns: ["id"]
          },
        ]
      }
      content_item_rating_totals: {
        Row: {
          content_item_id: string
          thumbs_down: number
          thumbs_up: number
          updated_at: string
        }
        Insert: {
          content_item_id: string
          thumbs_down?: number
          thumbs_up?: number
          updated_at?: string
        }
        Update: {
          content_item_id?: string
          thumbs_down?: number
          thumbs_up?: number
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "content_item_rating_totals_content_item_id_fkey"
            columns: ["content_item_id"]
            isOneToOne: true
            referencedRelation: "content_items"
            referencedColumns: ["id"]
          },
        ]
      }
      content_item_stats: {
        Row: {
          avg_media_progress_pct: number | null
          avg_session_seconds: number | null
          complete_count: number
          completion_rate: number
          content_item_id: string
          drop_off_count: number
          open_count: number
          total_session_seconds: number | null
          updated_at: string
        }
        Insert: {
          avg_media_progress_pct?: number | null
          avg_session_seconds?: number | null
          complete_count?: number
          completion_rate?: number
          content_item_id: string
          drop_off_count?: number
          open_count?: number
          total_session_seconds?: number | null
          updated_at?: string
        }
        Update: {
          avg_media_progress_pct?: number | null
          avg_session_seconds?: number | null
          complete_count?: number
          completion_rate?: number
          content_item_id?: string
          drop_off_count?: number
          open_count?: number
          total_session_seconds?: number | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "content_item_stats_content_item_id_fkey"
            columns: ["content_item_id"]
            isOneToOne: true
            referencedRelation: "content_items"
            referencedColumns: ["id"]
          },
        ]
      }
      content_item_time_totals: {
        Row: {
          content_item_id: string
          engager_count: number | null
          total_session_seconds: number | null
          updated_at: string | null
        }
        Insert: {
          content_item_id: string
          engager_count?: number | null
          total_session_seconds?: number | null
          updated_at?: string | null
        }
        Update: {
          content_item_id?: string
          engager_count?: number | null
          total_session_seconds?: number | null
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "content_item_time_totals_content_item_id_fkey"
            columns: ["content_item_id"]
            isOneToOne: true
            referencedRelation: "content_items"
            referencedColumns: ["id"]
          },
        ]
      }
      content_items: {
        Row: {
          category_id: string
          created_at: string
          description: string
          description_es: string | null
          duration: string
          exempt_from_progress: boolean
          file_name: string | null
          file_name_es: string | null
          file_url: string | null
          file_url_es: string | null
          id: string
          published: boolean
          sort_order: number
          source: string
          source_es: string | null
          title: string
          title_es: string | null
          type: string
          updated_at: string
          url: string | null
        }
        Insert: {
          category_id: string
          created_at?: string
          description?: string
          description_es?: string | null
          duration?: string
          exempt_from_progress?: boolean
          file_name?: string | null
          file_name_es?: string | null
          file_url?: string | null
          file_url_es?: string | null
          id?: string
          published?: boolean
          sort_order?: number
          source?: string
          source_es?: string | null
          title: string
          title_es?: string | null
          type?: string
          updated_at?: string
          url?: string | null
        }
        Update: {
          category_id?: string
          created_at?: string
          description?: string
          description_es?: string | null
          duration?: string
          exempt_from_progress?: boolean
          file_name?: string | null
          file_name_es?: string | null
          file_url?: string | null
          file_url_es?: string | null
          id?: string
          published?: boolean
          sort_order?: number
          source?: string
          source_es?: string | null
          title?: string
          title_es?: string | null
          type?: string
          updated_at?: string
          url?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "content_items_category_id_fkey"
            columns: ["category_id"]
            isOneToOne: false
            referencedRelation: "categories"
            referencedColumns: ["id"]
          },
        ]
      }
      custom_home_page_categories: {
        Row: {
          category_id: string
          created_at: string
          custom_home_page_id: string
          id: string
          sort_order: number
        }
        Insert: {
          category_id: string
          created_at?: string
          custom_home_page_id: string
          id?: string
          sort_order?: number
        }
        Update: {
          category_id?: string
          created_at?: string
          custom_home_page_id?: string
          id?: string
          sort_order?: number
        }
        Relationships: [
          {
            foreignKeyName: "custom_home_page_categories_category_id_fkey"
            columns: ["category_id"]
            isOneToOne: false
            referencedRelation: "categories"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "custom_home_page_categories_custom_home_page_id_fkey"
            columns: ["custom_home_page_id"]
            isOneToOne: false
            referencedRelation: "custom_home_pages"
            referencedColumns: ["id"]
          },
        ]
      }
      custom_home_pages: {
        Row: {
          allowed_ips: string[]
          created_at: string
          description: string
          id: string
          name: string
          slug: string
          updated_at: string
        }
        Insert: {
          allowed_ips?: string[]
          created_at?: string
          description?: string
          id?: string
          name?: string
          slug: string
          updated_at?: string
        }
        Update: {
          allowed_ips?: string[]
          created_at?: string
          description?: string
          id?: string
          name?: string
          slug?: string
          updated_at?: string
        }
        Relationships: []
      }
      error_logs: {
        Row: {
          context: Json
          created_at: string
          id: string
          ip_address: string | null
          level: string
          message: string
          route: string | null
          source: string
          stack: string | null
          user_agent: string | null
          user_id: string | null
        }
        Insert: {
          context?: Json
          created_at?: string
          id?: string
          ip_address?: string | null
          level?: string
          message: string
          route?: string | null
          source: string
          stack?: string | null
          user_agent?: string | null
          user_id?: string | null
        }
        Update: {
          context?: Json
          created_at?: string
          id?: string
          ip_address?: string | null
          level?: string
          message?: string
          route?: string | null
          source?: string
          stack?: string | null
          user_agent?: string | null
          user_id?: string | null
        }
        Relationships: []
      }
      facilities: {
        Row: {
          created_at: string
          hidden: boolean
          id: string
          label: string
          site_id: string | null
          sort_order: number
          updated_at: string
          value: string
        }
        Insert: {
          created_at?: string
          hidden?: boolean
          id?: string
          label: string
          site_id?: string | null
          sort_order?: number
          updated_at?: string
          value: string
        }
        Update: {
          created_at?: string
          hidden?: boolean
          id?: string
          label?: string
          site_id?: string | null
          sort_order?: number
          updated_at?: string
          value?: string
        }
        Relationships: []
      }
      facility_stats: {
        Row: {
          active_users_30d: number
          active_users_7d: number
          avg_completion_rate: number | null
          bookmark_count: number
          facility_value: string
          items_completed_total: number
          thumbs_down_count: number
          thumbs_up_count: number
          total_session_seconds: number
          total_users: number
          updated_at: string
        }
        Insert: {
          active_users_30d?: number
          active_users_7d?: number
          avg_completion_rate?: number | null
          bookmark_count?: number
          facility_value: string
          items_completed_total?: number
          thumbs_down_count?: number
          thumbs_up_count?: number
          total_session_seconds?: number
          total_users?: number
          updated_at?: string
        }
        Update: {
          active_users_30d?: number
          active_users_7d?: number
          avg_completion_rate?: number | null
          bookmark_count?: number
          facility_value?: string
          items_completed_total?: number
          thumbs_down_count?: number
          thumbs_up_count?: number
          total_session_seconds?: number
          total_users?: number
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "facility_stats_facility_value_fkey"
            columns: ["facility_value"]
            isOneToOne: true
            referencedRelation: "facilities"
            referencedColumns: ["value"]
          },
        ]
      }
      ip_allowlist: {
        Row: {
          created_at: string
          id: string
          ip_address: string
          label: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          id?: string
          ip_address: string
          label?: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          id?: string
          ip_address?: string
          label?: string
          updated_at?: string
        }
        Relationships: []
      }
      ip_passkey_attempts: {
        Row: {
          blocked_at: string | null
          created_at: string
          failed_count: number
          id: string
          ip_address: string
          last_attempt_at: string
          updated_at: string
        }
        Insert: {
          blocked_at?: string | null
          created_at?: string
          failed_count?: number
          id?: string
          ip_address: string
          last_attempt_at?: string
          updated_at?: string
        }
        Update: {
          blocked_at?: string | null
          created_at?: string
          failed_count?: number
          id?: string
          ip_address?: string
          last_attempt_at?: string
          updated_at?: string
        }
        Relationships: []
      }
      password_reset_attempts: {
        Row: {
          created_at: string
          id: string
          ip_address: string
          username: string
        }
        Insert: {
          created_at?: string
          id?: string
          ip_address: string
          username: string
        }
        Update: {
          created_at?: string
          id?: string
          ip_address?: string
          username?: string
        }
        Relationships: []
      }
      signup_attempts: {
        Row: {
          created_at: string
          id: string
          ip_address: string
          username: string
        }
        Insert: {
          created_at?: string
          id?: string
          ip_address: string
          username: string
        }
        Update: {
          created_at?: string
          id?: string
          ip_address?: string
          username?: string
        }
        Relationships: []
      }
      site_settings: {
        Row: {
          created_at: string
          key: string
          updated_at: string
          value: Json
        }
        Insert: {
          created_at?: string
          key: string
          updated_at?: string
          value?: Json
        }
        Update: {
          created_at?: string
          key?: string
          updated_at?: string
          value?: Json
        }
        Relationships: []
      }
      user_achievements: {
        Row: {
          achievement_key: string
          earned_at: string
          user_id: string
        }
        Insert: {
          achievement_key: string
          earned_at?: string
          user_id: string
        }
        Update: {
          achievement_key?: string
          earned_at?: string
          user_id?: string
        }
        Relationships: []
      }
      user_content_bookmarks: {
        Row: {
          content_item_id: string
          created_at: string
          user_id: string
        }
        Insert: {
          content_item_id: string
          created_at?: string
          user_id: string
        }
        Update: {
          content_item_id?: string
          created_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "user_content_bookmarks_content_item_id_fkey"
            columns: ["content_item_id"]
            isOneToOne: false
            referencedRelation: "content_items"
            referencedColumns: ["id"]
          },
        ]
      }
      user_content_engagement: {
        Row: {
          category_id: string
          content_item_id: string
          created_at: string
          id: string
          last_updated_at: string
          manual_completion_pct: number | null
          media_duration_seconds: number | null
          media_progress_seconds: number | null
          session_seconds: number
          user_id: string
        }
        Insert: {
          category_id: string
          content_item_id: string
          created_at?: string
          id?: string
          last_updated_at?: string
          manual_completion_pct?: number | null
          media_duration_seconds?: number | null
          media_progress_seconds?: number | null
          session_seconds?: number
          user_id: string
        }
        Update: {
          category_id?: string
          content_item_id?: string
          created_at?: string
          id?: string
          last_updated_at?: string
          manual_completion_pct?: number | null
          media_duration_seconds?: number | null
          media_progress_seconds?: number | null
          session_seconds?: number
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "user_content_engagement_content_item_id_fkey"
            columns: ["content_item_id"]
            isOneToOne: false
            referencedRelation: "content_items"
            referencedColumns: ["id"]
          },
        ]
      }
      user_content_progress: {
        Row: {
          category_id: string
          content_item_id: string
          created_at: string
          id: string
          user_id: string
        }
        Insert: {
          category_id: string
          content_item_id: string
          created_at?: string
          id?: string
          user_id: string
        }
        Update: {
          category_id?: string
          content_item_id?: string
          created_at?: string
          id?: string
          user_id?: string
        }
        Relationships: []
      }
      user_content_ratings: {
        Row: {
          content_item_id: string
          created_at: string
          rating: number
          updated_at: string
          user_id: string
        }
        Insert: {
          content_item_id: string
          created_at?: string
          rating: number
          updated_at?: string
          user_id: string
        }
        Update: {
          content_item_id?: string
          created_at?: string
          rating?: number
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "user_content_ratings_content_item_id_fkey"
            columns: ["content_item_id"]
            isOneToOne: false
            referencedRelation: "content_items"
            referencedColumns: ["id"]
          },
        ]
      }
      user_content_seen: {
        Row: {
          content_item_id: string
          seen_at: string
          user_id: string
        }
        Insert: {
          content_item_id: string
          seen_at?: string
          user_id: string
        }
        Update: {
          content_item_id?: string
          seen_at?: string
          user_id?: string
        }
        Relationships: []
      }
      user_content_sessions: {
        Row: {
          category_id: string
          content_item_id: string
          id: string
          recorded_at: string
          session_seconds: number
          user_id: string
        }
        Insert: {
          category_id: string
          content_item_id: string
          id?: string
          recorded_at?: string
          session_seconds: number
          user_id: string
        }
        Update: {
          category_id?: string
          content_item_id?: string
          id?: string
          recorded_at?: string
          session_seconds?: number
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "user_content_sessions_category_id_fkey"
            columns: ["category_id"]
            isOneToOne: false
            referencedRelation: "categories"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "user_content_sessions_content_item_id_fkey"
            columns: ["content_item_id"]
            isOneToOne: false
            referencedRelation: "content_items"
            referencedColumns: ["id"]
          },
        ]
      }
      user_dismissed_messages: {
        Row: {
          created_at: string
          dismissed_version: string
          id: string
          message_kind: string
          updated_at: string
          user_id: string
        }
        Insert: {
          created_at?: string
          dismissed_version: string
          id?: string
          message_kind: string
          updated_at?: string
          user_id: string
        }
        Update: {
          created_at?: string
          dismissed_version?: string
          id?: string
          message_kind?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      user_logins: {
        Row: {
          created_at: string
          id: string
          login_date: string
          user_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          login_date: string
          user_id: string
        }
        Update: {
          created_at?: string
          id?: string
          login_date?: string
          user_id?: string
        }
        Relationships: []
      }
      user_profiles: {
        Row: {
          created_at: string
          facility: string
          first_name: string
          inmate_pin: string | null
          is_synthetic: boolean
          last_name: string
          updated_at: string
          user_id: string
          username: string
        }
        Insert: {
          created_at?: string
          facility: string
          first_name?: string
          inmate_pin?: string | null
          is_synthetic?: boolean
          last_name?: string
          updated_at?: string
          user_id: string
          username: string
        }
        Update: {
          created_at?: string
          facility?: string
          first_name?: string
          inmate_pin?: string | null
          is_synthetic?: boolean
          last_name?: string
          updated_at?: string
          user_id?: string
          username?: string
        }
        Relationships: []
      }
      user_roles: {
        Row: {
          created_at: string
          id: string
          role: Database["public"]["Enums"]["app_role"]
          user_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          role: Database["public"]["Enums"]["app_role"]
          user_id: string
        }
        Update: {
          created_at?: string
          id?: string
          role?: Database["public"]["Enums"]["app_role"]
          user_id?: string
        }
        Relationships: []
      }
      user_security_answers: {
        Row: {
          answer_hash: string
          created_at: string
          id: string
          question_key: string
          updated_at: string
          user_id: string
        }
        Insert: {
          answer_hash: string
          created_at?: string
          id?: string
          question_key: string
          updated_at?: string
          user_id: string
        }
        Update: {
          answer_hash?: string
          created_at?: string
          id?: string
          question_key?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      user_stats: {
        Row: {
          facility_percentile: number | null
          facility_value: string | null
          items_completed: number
          items_started: number
          total_session_seconds: number
          updated_at: string
          user_id: string
        }
        Insert: {
          facility_percentile?: number | null
          facility_value?: string | null
          items_completed?: number
          items_started?: number
          total_session_seconds?: number
          updated_at?: string
          user_id: string
        }
        Update: {
          facility_percentile?: number | null
          facility_value?: string | null
          items_completed?: number
          items_started?: number
          total_session_seconds?: number
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      check_and_record_reset_attempt: {
        Args: {
          p_ip: string
          p_max: number
          p_since: string
          p_username: string
        }
        Returns: undefined
      }
      has_role: {
        Args: {
          _role: Database["public"]["Enums"]["app_role"]
          _user_id: string
        }
        Returns: boolean
      }
      refresh_analytics_stats: { Args: never; Returns: undefined }
      refresh_nightly: { Args: never; Returns: undefined }
      username_exists: { Args: { _username: string }; Returns: boolean }
    }
    Enums: {
      app_role: "admin" | "contributor" | "user" | "tester" | "facilityUser"
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
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
        DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])
    : never = never,
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
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never = never,
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
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never = never,
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
  EnumName extends DefaultSchemaEnumNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"]
    : never = never,
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
  CompositeTypeName extends PublicCompositeTypeNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"]
    : never = never,
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
      app_role: ["admin", "contributor", "user", "tester", "facilityUser"],
    },
  },
} as const
