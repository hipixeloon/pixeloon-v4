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
    PostgrestVersion: "14.1"
  }
  public: {
    Tables: {
      access_requests: {
        Row: {
          created_at: string
          id: string
          reason: string
          review_notes: string | null
          reviewed_at: string | null
          reviewed_by: string | null
          status: string
          updated_at: string
          user_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          reason: string
          review_notes?: string | null
          reviewed_at?: string | null
          reviewed_by?: string | null
          status?: string
          updated_at?: string
          user_id: string
        }
        Update: {
          created_at?: string
          id?: string
          reason?: string
          review_notes?: string | null
          reviewed_at?: string | null
          reviewed_by?: string | null
          status?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      activity_logs: {
        Row: {
          action: string
          created_at: string
          details: Json | null
          entity_id: string | null
          entity_type: string
          id: string
          ip_address: string | null
          user_id: string | null
        }
        Insert: {
          action: string
          created_at?: string
          details?: Json | null
          entity_id?: string | null
          entity_type: string
          id?: string
          ip_address?: string | null
          user_id?: string | null
        }
        Update: {
          action?: string
          created_at?: string
          details?: Json | null
          entity_id?: string | null
          entity_type?: string
          id?: string
          ip_address?: string | null
          user_id?: string | null
        }
        Relationships: []
      }
      api_connection_logs: {
        Row: {
          created_at: string
          error_message: string | null
          id: string
          metadata: Json | null
          service_name: string
          status: string
          user_id: string
        }
        Insert: {
          created_at?: string
          error_message?: string | null
          id?: string
          metadata?: Json | null
          service_name: string
          status: string
          user_id: string
        }
        Update: {
          created_at?: string
          error_message?: string | null
          id?: string
          metadata?: Json | null
          service_name?: string
          status?: string
          user_id?: string
        }
        Relationships: []
      }
      app_settings: {
        Row: {
          description: string | null
          id: string
          key: string
          updated_at: string
          updated_by: string | null
          value: Json
          default_ai_model: string | null
          default_branding_lines: Json | null
        }
        Insert: {
          description?: string | null
          id?: string
          key: string
          updated_at?: string
          updated_by?: string | null
          value?: Json
          default_ai_model?: string | null
          default_branding_lines?: Json | null
        }
        Update: {
          description?: string | null
          id?: string
          key?: string
          updated_at?: string
          updated_by?: string | null
          value?: Json
          default_ai_model?: string | null
          default_branding_lines?: Json | null
        }
        Relationships: []
      }
      campaign_pages: {
        Row: {
          campaign_id: string
          created_at: string
          facebook_page_id: string
          id: string
        }
        Insert: {
          campaign_id: string
          created_at?: string
          facebook_page_id: string
          id?: string
        }
        Update: {
          campaign_id?: string
          created_at?: string
          facebook_page_id?: string
          id?: string
        }
        Relationships: [
          {
            foreignKeyName: "campaign_pages_campaign_id_fkey"
            columns: ["campaign_id"]
            isOneToOne: false
            referencedRelation: "campaigns"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "campaign_pages_facebook_page_id_fkey"
            columns: ["facebook_page_id"]
            isOneToOne: false
            referencedRelation: "facebook_pages"
            referencedColumns: ["id"]
          },
        ]
      }
      campaign_instagram_accounts: {
        Row: {
          campaign_id: string
          created_at: string
          id: string
          instagram_account_id: string
        }
        Insert: {
          campaign_id: string
          created_at?: string
          id?: string
          instagram_account_id: string
        }
        Update: {
          campaign_id?: string
          created_at?: string
          id?: string
          instagram_account_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "campaign_instagram_accounts_campaign_id_fkey"
            columns: ["campaign_id"]
            isOneToOne: false
            referencedRelation: "campaigns"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "campaign_instagram_accounts_instagram_account_id_fkey"
            columns: ["instagram_account_id"]
            isOneToOne: false
            referencedRelation: "instagram_accounts"
            referencedColumns: ["id"]
          },
        ]
      }
      campaign_youtube_channels: {
        Row: {
          campaign_id: string
          created_at: string
          id: string
          youtube_channel_id: string
        }
        Insert: {
          campaign_id: string
          created_at?: string
          id?: string
          youtube_channel_id: string
        }
        Update: {
          campaign_id?: string
          created_at?: string
          id?: string
          youtube_channel_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "campaign_youtube_channels_campaign_id_fkey"
            columns: ["campaign_id"]
            isOneToOne: false
            referencedRelation: "campaigns"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "campaign_youtube_channels_youtube_channel_id_fkey"
            columns: ["youtube_channel_id"]
            isOneToOne: false
            referencedRelation: "youtube_channels"
            referencedColumns: ["id"]
          },
        ]
      }
      campaign_platforms: {
        Row: {
          account_id: string
          campaign_id: string
          created_at: string
          id: string
          platform: string
        }
        Insert: {
          account_id: string
          campaign_id: string
          created_at?: string
          id?: string
          platform: string
        }
        Update: {
          account_id?: string
          campaign_id?: string
          created_at?: string
          id?: string
          platform?: string
        }
        Relationships: [
          {
            foreignKeyName: "campaign_platforms_campaign_id_fkey"
            columns: ["campaign_id"]
            isOneToOne: false
            referencedRelation: "campaigns"
            referencedColumns: ["id"]
          },
        ]
      }
      campaign_post_times: {
        Row: {
          campaign_id: string
          created_at: string
          id: string
          post_time: string
          random_range_minutes: number | null
          randomize: boolean | null
        }
        Insert: {
          campaign_id: string
          created_at?: string
          id?: string
          post_time: string
          random_range_minutes?: number | null
          randomize?: boolean | null
        }
        Update: {
          campaign_id?: string
          created_at?: string
          id?: string
          post_time?: string
          random_range_minutes?: number | null
          randomize?: boolean | null
        }
        Relationships: [
          {
            foreignKeyName: "campaign_post_times_campaign_id_fkey"
            columns: ["campaign_id"]
            isOneToOne: false
            referencedRelation: "campaigns"
            referencedColumns: ["id"]
          },
        ]
      }
      campaigns: {
        Row: {
          caption_length: string | null
          created_at: string
          custom_caption: string | null
          description: string | null
          drive_folder_id: string | null
          drive_folder_name: string | null
          hashtag_count: number | null
          hashtags: string[] | null
          id: string
          posts_count: number | null
          schedule_time: string | null
          status: string | null
          template_type: string | null
          title: string
          updated_at: string
          user_id: string
          video_links: string[] | null
          targeting_country: string | null
          targeting_tone: string | null
          branding_lines: Json | null
          affiliate_links: Json | null
          watermark_settings: Json | null
          ab_test_enabled: boolean | null
          platforms: Json | null
          video_order_mode: string | null
          start_video_index: number | null
          sequence_step: number | null
          avoid_same_time_video_collisions: boolean | null
          youtube_upload_type: string | null
          logo_opacity: number | null
          fallback_captions_enabled: boolean | null
          fallback_captions: string[] | null
          schedule_generating_at: string | null
          youtube_title_language: string | null
          youtube_thumbnail_mode: string
          youtube_thumbnail_url: string | null
          youtube_thumbnail_title_overlay: boolean
        }
        Insert: {
          caption_length?: string | null
          created_at?: string
          custom_caption?: string | null
          description?: string | null
          drive_folder_id?: string | null
          drive_folder_name?: string | null
          hashtag_count?: number | null
          hashtags?: string[] | null
          id?: string
          posts_count?: number | null
          schedule_time?: string | null
          status?: string | null
          template_type?: string | null
          title: string
          updated_at?: string
          user_id: string
          video_links?: string[] | null
          targeting_country?: string | null
          targeting_tone?: string | null
          branding_lines?: Json | null
          affiliate_links?: Json | null
          watermark_settings?: Json | null
          ab_test_enabled?: boolean | null
          platforms?: Json | null
          video_order_mode?: string | null
          start_video_index?: number | null
          sequence_step?: number | null
          avoid_same_time_video_collisions?: boolean | null
          youtube_upload_type?: string | null
          logo_opacity?: number | null
          fallback_captions_enabled?: boolean | null
          fallback_captions?: string[] | null
          schedule_generating_at?: string | null
          youtube_title_language?: string | null
          youtube_thumbnail_mode?: string
          youtube_thumbnail_url?: string | null
          youtube_thumbnail_title_overlay?: boolean
        }
        Update: {
          caption_length?: string | null
          created_at?: string
          custom_caption?: string | null
          description?: string | null
          drive_folder_id?: string | null
          drive_folder_name?: string | null
          hashtag_count?: number | null
          hashtags?: string[] | null
          id?: string
          posts_count?: number | null
          schedule_time?: string | null
          status?: string | null
          template_type?: string | null
          title?: string
          updated_at?: string
          user_id?: string
          video_links?: string[] | null
          targeting_country?: string | null
          targeting_tone?: string | null
          branding_lines?: Json | null
          affiliate_links?: Json | null
          watermark_settings?: Json | null
          ab_test_enabled?: boolean | null
          platforms?: Json | null
          video_order_mode?: string | null
          start_video_index?: number | null
          sequence_step?: number | null
          avoid_same_time_video_collisions?: boolean | null
          youtube_upload_type?: string | null
          logo_opacity?: number | null
          fallback_captions_enabled?: boolean | null
          fallback_captions?: string[] | null
          schedule_generating_at?: string | null
          youtube_title_language?: string | null
          youtube_thumbnail_mode?: string
          youtube_thumbnail_url?: string | null
          youtube_thumbnail_title_overlay?: boolean
        }
        Relationships: []
      }
      facebook_connections: {
        Row: {
          created_at: string
          id: string
          updated_at: string
          user_access_token: string
          user_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          updated_at?: string
          user_access_token: string
          user_id: string
        }
        Update: {
          created_at?: string
          id?: string
          updated_at?: string
          user_access_token?: string
          user_id?: string
        }
        Relationships: []
      }
      facebook_pages: {
        Row: {
          access_token: string
          created_at: string
          id: string
          page_id: string
          page_name: string
          updated_at: string
          user_id: string
        }
        Insert: {
          access_token: string
          created_at?: string
          id?: string
          page_id: string
          page_name: string
          updated_at?: string
          user_id: string
        }
        Update: {
          access_token?: string
          created_at?: string
          id?: string
          page_id?: string
          page_name?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      instagram_accounts: {
        Row: {
          created_at: string
          facebook_page_id: string | null
          id: string
          instagram_account_id: string
          instagram_username: string
          profile_picture_url: string | null
          updated_at: string
          user_id: string
        }
        Insert: {
          created_at?: string
          facebook_page_id?: string | null
          id?: string
          instagram_account_id: string
          instagram_username: string
          profile_picture_url?: string | null
          updated_at?: string
          user_id: string
        }
        Update: {
          created_at?: string
          facebook_page_id?: string | null
          id?: string
          instagram_account_id?: string
          instagram_username?: string
          profile_picture_url?: string | null
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "instagram_accounts_facebook_page_id_fkey"
            columns: ["facebook_page_id"]
            isOneToOne: false
            referencedRelation: "facebook_pages"
            referencedColumns: ["id"]
          },
        ]
      }
      profiles: {
        Row: {
          avatar_url: string | null
          banned_at: string | null
          banned_reason: string | null
          country_code: string | null
          created_at: string
          email: string
          facebook_enabled: boolean | null
          full_name: string | null
          id: string
          instagram_enabled: boolean | null
          is_banned: boolean | null
          max_campaigns: number | null
          max_posts_per_day: number | null
          subscription_expires_at: string | null
          updated_at: string
          user_id: string
          watermark_image_path: string | null
          youtube_enabled: boolean | null
        }
        Insert: {
          avatar_url?: string | null
          banned_at?: string | null
          banned_reason?: string | null
          country_code?: string | null
          created_at?: string
          email: string
          facebook_enabled?: boolean | null
          full_name?: string | null
          id?: string
          instagram_enabled?: boolean | null
          is_banned?: boolean | null
          max_campaigns?: number | null
          max_posts_per_day?: number | null
          subscription_expires_at?: string | null
          updated_at?: string
          user_id: string
          watermark_image_path?: string | null
          youtube_enabled?: boolean | null
        }
        Update: {
          avatar_url?: string | null
          banned_at?: string | null
          banned_reason?: string | null
          country_code?: string | null
          created_at?: string
          email?: string
          facebook_enabled?: boolean | null
          full_name?: string | null
          id?: string
          instagram_enabled?: boolean | null
          is_banned?: boolean | null
          max_campaigns?: number | null
          max_posts_per_day?: number | null
          subscription_expires_at?: string | null
          updated_at?: string
          user_id?: string
          watermark_image_path?: string | null
          youtube_enabled?: boolean | null
        }
        Relationships: []
      }
      scheduled_posts: {
        Row: {
          actual_post_time: string | null
          campaign_id: string
          caption: string | null
          created_at: string
          error_message: string | null
          facebook_page_id: string | null
          facebook_post_id: string | null
          hashtags: string[] | null
          id: string
          instagram_media_id: string | null
          needs_ai_caption: boolean | null
          permalink_url: string | null
          processing_started_at: string | null
          platform: string | null
          post_type: string | null
          scheduled_time: string
          status: string
          updated_at: string
          video_url: string
          youtube_video_id: string | null
          likes_count: number | null
          engagement_count: number | null
          ab_variant: string | null
          platforms: Json | null
          instagram_account_id: string | null
          youtube_channel_id: string | null
        }
        Insert: {
          actual_post_time?: string | null
          campaign_id: string
          caption?: string | null
          created_at?: string
          error_message?: string | null
          facebook_page_id?: string | null
          facebook_post_id?: string | null
          hashtags?: string[] | null
          id?: string
          instagram_media_id?: string | null
          needs_ai_caption?: boolean | null
          permalink_url?: string | null
          processing_started_at?: string | null
          platform?: string | null
          post_type?: string | null
          scheduled_time: string
          status?: string
          updated_at?: string
          video_url: string
          youtube_video_id?: string | null
          likes_count?: number | null
          engagement_count?: number | null
          ab_variant?: string | null
          platforms?: Json | null
          instagram_account_id?: string | null
          youtube_channel_id?: string | null
        }
        Update: {
          actual_post_time?: string | null
          campaign_id?: string
          caption?: string | null
          created_at?: string
          error_message?: string | null
          facebook_page_id?: string | null
          facebook_post_id?: string | null
          hashtags?: string[] | null
          id?: string
          instagram_media_id?: string | null
          needs_ai_caption?: boolean | null
          permalink_url?: string | null
          processing_started_at?: string | null
          platform?: string | null
          post_type?: string | null
          scheduled_time?: string
          status?: string
          updated_at?: string
          video_url?: string
          youtube_video_id?: string | null
          likes_count?: number | null
          engagement_count?: number | null
          ab_variant?: string | null
          platforms?: Json | null
          instagram_account_id?: string | null
          youtube_channel_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "scheduled_posts_campaign_id_fkey"
            columns: ["campaign_id"]
            isOneToOne: false
            referencedRelation: "campaigns"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "scheduled_posts_facebook_page_id_fkey"
            columns: ["facebook_page_id"]
            isOneToOne: false
            referencedRelation: "facebook_pages"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "scheduled_posts_instagram_account_id_fkey"
            columns: ["instagram_account_id"]
            isOneToOne: false
            referencedRelation: "instagram_accounts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "scheduled_posts_youtube_channel_id_fkey"
            columns: ["youtube_channel_id"]
            isOneToOne: false
            referencedRelation: "youtube_channels"
            referencedColumns: ["id"]
          },
        ]
      }
      user_api_keys: {
        Row: {
          api_key: string
          created_at: string
          id: string
          key_name: string
          updated_at: string
          user_id: string
        }
        Insert: {
          api_key: string
          created_at?: string
          id?: string
          key_name: string
          updated_at?: string
          user_id: string
        }
        Update: {
          api_key?: string
          created_at?: string
          id?: string
          key_name?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      user_permissions: {
        Row: {
          granted_at: string
          granted_by: string | null
          id: string
          permission: Database["public"]["Enums"]["permission_type"]
          user_id: string
        }
        Insert: {
          granted_at?: string
          granted_by?: string | null
          id?: string
          permission: Database["public"]["Enums"]["permission_type"]
          user_id: string
        }
        Update: {
          granted_at?: string
          granted_by?: string | null
          id?: string
          permission?: Database["public"]["Enums"]["permission_type"]
          user_id?: string
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
      user_subscriptions: {
        Row: {
          amount_paid: number | null
          created_at: string
          expires_at: string
          granted_by: string | null
          id: string
          is_active: boolean
          payment_method: string | null
          plan_name: string
          starts_at: string
          updated_at: string
          user_id: string
        }
        Insert: {
          amount_paid?: number | null
          created_at?: string
          expires_at: string
          granted_by?: string | null
          id?: string
          is_active?: boolean
          payment_method?: string | null
          plan_name: string
          starts_at?: string
          updated_at?: string
          user_id: string
        }
        Update: {
          amount_paid?: number | null
          created_at?: string
          expires_at?: string
          granted_by?: string | null
          id?: string
          is_active?: boolean
          payment_method?: string | null
          plan_name?: string
          starts_at?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      youtube_channels: {
        Row: {
          access_token: string
          channel_id: string
          channel_name: string
          channel_thumbnail: string | null
          created_at: string
          id: string
          refresh_token: string
          token_expires_at: string
          updated_at: string
          user_id: string
        }
        Insert: {
          access_token: string
          channel_id: string
          channel_name: string
          channel_thumbnail?: string | null
          created_at?: string
          id?: string
          refresh_token: string
          token_expires_at: string
          updated_at?: string
          user_id: string
        }
        Update: {
          access_token?: string
          channel_id?: string
          channel_name?: string
          channel_thumbnail?: string | null
          created_at?: string
          id?: string
          refresh_token?: string
          token_expires_at?: string
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
      can_create_content: { Args: { _user_id: string }; Returns: boolean }
      get_cron_executions: {
        Args: never
        Returns: {
          created: string
          id: number
          status_code: number
          timed_out: boolean
        }[]
      }
      get_cron_job_status: {
        Args: never
        Returns: {
          active: boolean
          jobname: string
          schedule: string
        }[]
      }
      has_permission: {
        Args: {
          _permission: Database["public"]["Enums"]["permission_type"]
          _user_id: string
        }
        Returns: boolean
      }
      has_role: {
        Args: {
          _role: Database["public"]["Enums"]["app_role"]
          _user_id: string
        }
        Returns: boolean
      }
      is_admin_or_moderator: { Args: { _user_id: string }; Returns: boolean }
    }
    Enums: {
      app_role: "admin" | "moderator" | "user"
      permission_type: "creator" | "viewer"
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
      app_role: ["admin", "moderator", "user"],
      permission_type: ["creator", "viewer"],
    },
  },
} as const
