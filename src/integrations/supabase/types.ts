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
      analytics_events: {
        Row: {
          category_id: string | null
          content_id: string | null
          created_at: string
          event_type: string
          id: string
        }
        Insert: {
          category_id?: string | null
          content_id?: string | null
          created_at?: string
          event_type: string
          id?: string
        }
        Update: {
          category_id?: string | null
          content_id?: string | null
          created_at?: string
          event_type?: string
          id?: string
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
      auth_ip_allowlist: {
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
      categories: {
        Row: {
          created_at: string
          description: string
          description_es: string | null
          home_page_mode: string
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
      content_items: {
        Row: {
          category_id: string
          created_at: string
          description: string
          description_es: string | null
          duration: string
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
      facilities: {
        Row: {
          created_at: string
          id: string
          label: string
          sort_order: number
          updated_at: string
          value: string
        }
        Insert: {
          created_at?: string
          id?: string
          label: string
          sort_order?: number
          updated_at?: string
          value: string
        }
        Update: {
          created_at?: string
          id?: string
          label?: string
          sort_order?: number
          updated_at?: string
          value?: string
        }
        Relationships: []
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
          last_name: string
          updated_at: string
          user_id: string
          username: string
        }
        Insert: {
          created_at?: string
          facility: string
          first_name?: string
          last_name?: string
          updated_at?: string
          user_id: string
          username: string
        }
        Update: {
          created_at?: string
          facility?: string
          first_name?: string
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
      user_signup_ips: {
        Row: {
          created_at: string
          ip_address: string
          user_id: string
        }
        Insert: {
          created_at?: string
          ip_address: string
          user_id: string
        }
        Update: {
          created_at?: string
          ip_address?: string
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
          _role: Database["public"]["Enums"]["app_role"]
          _user_id: string
        }
        Returns: boolean
      }
      username_exists: { Args: { _username: string }; Returns: boolean }
    }
    Enums: {
      app_role: "admin" | "contributor" | "user"
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
      app_role: ["admin", "contributor", "user"],
    },
  },
} as const
