export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[]

export type Database = {
  public: {
    Tables: {
      events: {
        Row: {
          created_at: string
          date: string
          description: string | null
          id: string
          location: string
          time: string
          title: string
        }
        Insert: {
          created_at?: string
          date: string
          description?: string | null
          id?: string
          location: string
          time: string
          title: string
        }
        Update: {
          created_at?: string
          date?: string
          description?: string | null
          id?: string
          location?: string
          time?: string
          title?: string
        }
        Relationships: []
      }
      profiles: {
        Row: {
          avatar_url: string | null
          full_name: string | null
          id: string
          phone: string | null
          updated_at: string | null
        }
        Insert: {
          avatar_url?: string | null
          full_name?: string | null
          id: string
          phone?: string | null
          updated_at?: string | null
        }
        Update: {
          avatar_url?: string | null
          full_name?: string | null
          id?: string
          phone?: string | null
          updated_at?: string | null
        }
        Relationships: []
      }
      mesa_abierta_admin_roles: {
        Row: {
          id: string
          user_id: string
          role: Database['public']['Enums']['mesa_abierta_admin_role']
          created_at: string
          created_by: string | null
        }
        Insert: {
          id?: string
          user_id: string
          role?: Database['public']['Enums']['mesa_abierta_admin_role']
          created_at?: string
          created_by?: string | null
        }
        Update: {
          id?: string
          user_id?: string
          role?: Database['public']['Enums']['mesa_abierta_admin_role']
          created_at?: string
          created_by?: string | null
        }
        Relationships: []
      }
      mesa_abierta_months: {
        Row: {
          id: string
          month_date: string
          registration_deadline: string
          dinner_date: string
          dinner_time: string
          status: Database['public']['Enums']['mesa_abierta_month_status']
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string
          month_date: string
          registration_deadline: string
          dinner_date: string
          dinner_time?: string
          status?: Database['public']['Enums']['mesa_abierta_month_status']
          created_at?: string
          updated_at?: string
        }
        Update: {
          id?: string
          month_date?: string
          registration_deadline?: string
          dinner_date?: string
          dinner_time?: string
          status?: Database['public']['Enums']['mesa_abierta_month_status']
          created_at?: string
          updated_at?: string
        }
        Relationships: []
      }
      mesa_abierta_participants: {
        Row: {
          id: string
          user_id: string
          month_id: string
          role_preference: Database['public']['Enums']['mesa_abierta_role']
          assigned_role: Database['public']['Enums']['mesa_abierta_role'] | null
          has_plus_one: boolean
          plus_one_name: string | null
          recurring: boolean
          host_address: string | null
          host_max_guests: number | null
          phone_number: string | null
          whatsapp_enabled: boolean
          status: Database['public']['Enums']['mesa_abierta_participant_status']
          cancellation_reason: string | null
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string
          user_id: string
          month_id: string
          role_preference: Database['public']['Enums']['mesa_abierta_role']
          assigned_role?: Database['public']['Enums']['mesa_abierta_role'] | null
          has_plus_one?: boolean
          plus_one_name?: string | null
          recurring?: boolean
          host_address?: string | null
          host_max_guests?: number | null
          phone_number?: string | null
          whatsapp_enabled?: boolean
          status?: Database['public']['Enums']['mesa_abierta_participant_status']
          cancellation_reason?: string | null
          created_at?: string
          updated_at?: string
        }
        Update: {
          id?: string
          user_id?: string
          month_id?: string
          role_preference?: Database['public']['Enums']['mesa_abierta_role']
          assigned_role?: Database['public']['Enums']['mesa_abierta_role'] | null
          has_plus_one?: boolean
          plus_one_name?: string | null
          recurring?: boolean
          host_address?: string | null
          host_max_guests?: number | null
          phone_number?: string | null
          whatsapp_enabled?: boolean
          status?: Database['public']['Enums']['mesa_abierta_participant_status']
          cancellation_reason?: string | null
          created_at?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "mesa_abierta_participants_month_id_fkey"
            columns: ["month_id"]
            referencedRelation: "mesa_abierta_months"
            referencedColumns: ["id"]
          }
        ]
      }
      mesa_abierta_dietary_restrictions: {
        Row: {
          id: string
          participant_id: string
          restriction_type: Database['public']['Enums']['mesa_abierta_dietary_type']
          description: string | null
          severity: Database['public']['Enums']['mesa_abierta_dietary_severity']
          is_plus_one: boolean
          created_at: string
        }
        Insert: {
          id?: string
          participant_id: string
          restriction_type: Database['public']['Enums']['mesa_abierta_dietary_type']
          description?: string | null
          severity?: Database['public']['Enums']['mesa_abierta_dietary_severity']
          is_plus_one?: boolean
          created_at?: string
        }
        Update: {
          id?: string
          participant_id?: string
          restriction_type?: Database['public']['Enums']['mesa_abierta_dietary_type']
          description?: string | null
          severity?: Database['public']['Enums']['mesa_abierta_dietary_severity']
          is_plus_one?: boolean
          created_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "mesa_abierta_dietary_restrictions_participant_id_fkey"
            columns: ["participant_id"]
            referencedRelation: "mesa_abierta_participants"
            referencedColumns: ["id"]
          }
        ]
      }
      mesa_abierta_matches: {
        Row: {
          id: string
          month_id: string
          host_participant_id: string
          dinner_date: string
          dinner_time: string
          guest_count: number
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string
          month_id: string
          host_participant_id: string
          dinner_date: string
          dinner_time?: string
          guest_count?: number
          created_at?: string
          updated_at?: string
        }
        Update: {
          id?: string
          month_id?: string
          host_participant_id?: string
          dinner_date?: string
          dinner_time?: string
          guest_count?: number
          created_at?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "mesa_abierta_matches_month_id_fkey"
            columns: ["month_id"]
            referencedRelation: "mesa_abierta_months"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "mesa_abierta_matches_host_participant_id_fkey"
            columns: ["host_participant_id"]
            referencedRelation: "mesa_abierta_participants"
            referencedColumns: ["id"]
          }
        ]
      }
      mesa_abierta_assignments: {
        Row: {
          id: string
          match_id: string
          guest_participant_id: string
          food_assignment: Database['public']['Enums']['mesa_abierta_food_assignment']
          notification_sent: boolean
          notification_sent_at: string | null
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string
          match_id: string
          guest_participant_id: string
          food_assignment?: Database['public']['Enums']['mesa_abierta_food_assignment']
          notification_sent?: boolean
          notification_sent_at?: string | null
          created_at?: string
          updated_at?: string
        }
        Update: {
          id?: string
          match_id?: string
          guest_participant_id?: string
          food_assignment?: Database['public']['Enums']['mesa_abierta_food_assignment']
          notification_sent?: boolean
          notification_sent_at?: string | null
          created_at?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "mesa_abierta_assignments_match_id_fkey"
            columns: ["match_id"]
            referencedRelation: "mesa_abierta_matches"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "mesa_abierta_assignments_guest_participant_id_fkey"
            columns: ["guest_participant_id"]
            referencedRelation: "mesa_abierta_participants"
            referencedColumns: ["id"]
          }
        ]
      }
      mesa_abierta_email_logs: {
        Row: {
          id: string
          month_id: string | null
          participant_id: string | null
          email_type: Database['public']['Enums']['mesa_abierta_email_type']
          recipient_email: string
          subject: string | null
          sent_at: string
          status: Database['public']['Enums']['mesa_abierta_message_status']
          sendgrid_message_id: string | null
          error_message: string | null
        }
        Insert: {
          id?: string
          month_id?: string | null
          participant_id?: string | null
          email_type: Database['public']['Enums']['mesa_abierta_email_type']
          recipient_email: string
          subject?: string | null
          sent_at?: string
          status?: Database['public']['Enums']['mesa_abierta_message_status']
          sendgrid_message_id?: string | null
          error_message?: string | null
        }
        Update: {
          id?: string
          month_id?: string | null
          participant_id?: string | null
          email_type?: Database['public']['Enums']['mesa_abierta_email_type']
          recipient_email?: string
          subject?: string | null
          sent_at?: string
          status?: Database['public']['Enums']['mesa_abierta_message_status']
          sendgrid_message_id?: string | null
          error_message?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "mesa_abierta_email_logs_month_id_fkey"
            columns: ["month_id"]
            referencedRelation: "mesa_abierta_months"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "mesa_abierta_email_logs_participant_id_fkey"
            columns: ["participant_id"]
            referencedRelation: "mesa_abierta_participants"
            referencedColumns: ["id"]
          }
        ]
      }
      mesa_abierta_whatsapp_messages: {
        Row: {
          id: string
          participant_id: string | null
          month_id: string | null
          message_type: Database['public']['Enums']['mesa_abierta_whatsapp_type']
          phone_number: string
          message_content: string
          twilio_message_sid: string | null
          status: Database['public']['Enums']['mesa_abierta_message_status']
          sent_at: string
          delivered_at: string | null
          error_message: string | null
        }
        Insert: {
          id?: string
          participant_id?: string | null
          month_id?: string | null
          message_type: Database['public']['Enums']['mesa_abierta_whatsapp_type']
          phone_number: string
          message_content: string
          twilio_message_sid?: string | null
          status?: Database['public']['Enums']['mesa_abierta_message_status']
          sent_at?: string
          delivered_at?: string | null
          error_message?: string | null
        }
        Update: {
          id?: string
          participant_id?: string | null
          month_id?: string | null
          message_type?: Database['public']['Enums']['mesa_abierta_whatsapp_type']
          phone_number?: string
          message_content?: string
          twilio_message_sid?: string | null
          status?: Database['public']['Enums']['mesa_abierta_message_status']
          sent_at?: string
          delivered_at?: string | null
          error_message?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "mesa_abierta_whatsapp_messages_participant_id_fkey"
            columns: ["participant_id"]
            referencedRelation: "mesa_abierta_participants"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "mesa_abierta_whatsapp_messages_month_id_fkey"
            columns: ["month_id"]
            referencedRelation: "mesa_abierta_months"
            referencedColumns: ["id"]
          }
        ]
      }
      mesa_abierta_photos: {
        Row: {
          id: string
          match_id: string
          month_id: string
          uploaded_by: string
          photo_url: string
          caption: string | null
          is_approved: boolean
          is_featured: boolean
          created_at: string
          approved_at: string | null
          approved_by: string | null
        }
        Insert: {
          id?: string
          match_id: string
          month_id: string
          uploaded_by: string
          photo_url: string
          caption?: string | null
          is_approved?: boolean
          is_featured?: boolean
          created_at?: string
          approved_at?: string | null
          approved_by?: string | null
        }
        Update: {
          id?: string
          match_id?: string
          month_id?: string
          uploaded_by?: string
          photo_url?: string
          caption?: string | null
          is_approved?: boolean
          is_featured?: boolean
          created_at?: string
          approved_at?: string | null
          approved_by?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "mesa_abierta_photos_match_id_fkey"
            columns: ["match_id"]
            referencedRelation: "mesa_abierta_matches"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "mesa_abierta_photos_month_id_fkey"
            columns: ["month_id"]
            referencedRelation: "mesa_abierta_months"
            referencedColumns: ["id"]
          }
        ]
      }
      mesa_abierta_testimonials: {
        Row: {
          id: string
          month_id: string
          participant_id: string
          match_id: string | null
          rating: number
          testimonial_text: string | null
          would_participate_again: boolean
          what_went_well: string | null
          suggestions_for_improvement: string | null
          is_approved: boolean
          is_featured: boolean
          created_at: string
          approved_at: string | null
          approved_by: string | null
        }
        Insert: {
          id?: string
          month_id: string
          participant_id: string
          match_id?: string | null
          rating: number
          testimonial_text?: string | null
          would_participate_again: boolean
          what_went_well?: string | null
          suggestions_for_improvement?: string | null
          is_approved?: boolean
          is_featured?: boolean
          created_at?: string
          approved_at?: string | null
          approved_by?: string | null
        }
        Update: {
          id?: string
          month_id?: string
          participant_id?: string
          match_id?: string | null
          rating?: number
          testimonial_text?: string | null
          would_participate_again?: boolean
          what_went_well?: string | null
          suggestions_for_improvement?: string | null
          is_approved?: boolean
          is_featured?: boolean
          created_at?: string
          approved_at?: string | null
          approved_by?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "mesa_abierta_testimonials_month_id_fkey"
            columns: ["month_id"]
            referencedRelation: "mesa_abierta_months"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "mesa_abierta_testimonials_participant_id_fkey"
            columns: ["participant_id"]
            referencedRelation: "mesa_abierta_participants"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "mesa_abierta_testimonials_match_id_fkey"
            columns: ["match_id"]
            referencedRelation: "mesa_abierta_matches"
            referencedColumns: ["id"]
          }
        ]
      }
      casa_graphics_batches: {
        Row: {
          id: string
          name: string
          event_type: Database['public']['Enums']['graphics_event_type']
          event_date: string | null
          event_time: string | null
          event_location: string | null
          illustration_base64: string | null
          prompt_used: string | null
          created_by: string | null
          created_at: string
          metadata: Json
        }
        Insert: {
          id?: string
          name: string
          event_type?: Database['public']['Enums']['graphics_event_type']
          event_date?: string | null
          event_time?: string | null
          event_location?: string | null
          illustration_base64?: string | null
          prompt_used?: string | null
          created_by?: string | null
          created_at?: string
          metadata?: Json
        }
        Update: {
          id?: string
          name?: string
          event_type?: Database['public']['Enums']['graphics_event_type']
          event_date?: string | null
          event_time?: string | null
          event_location?: string | null
          illustration_base64?: string | null
          prompt_used?: string | null
          created_by?: string | null
          created_at?: string
          metadata?: Json
        }
        Relationships: []
      }
      casa_graphics_items: {
        Row: {
          id: string
          batch_id: string
          format: Database['public']['Enums']['graphics_format_v2']
          title: string
          image_url: string
          width: number
          height: number
          created_at: string
        }
        Insert: {
          id?: string
          batch_id: string
          format: Database['public']['Enums']['graphics_format_v2']
          title: string
          image_url: string
          width: number
          height: number
          created_at?: string
        }
        Update: {
          id?: string
          batch_id?: string
          format?: Database['public']['Enums']['graphics_format_v2']
          title?: string
          image_url?: string
          width?: number
          height?: number
          created_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "casa_graphics_items_batch_id_fkey"
            columns: ["batch_id"]
            referencedRelation: "casa_graphics_batches"
            referencedColumns: ["id"]
          }
        ]
      }
      // Published liturgy resources (Cuentacuento & Reflexion PDFs for home page)
      published_resources: {
        Row: {
          id: string
          resource_type: 'cuentacuento' | 'reflexion'
          liturgy_id: string | null
          liturgy_date: string
          title: string
          description: string | null
          pdf_url: string
          pdf_filename: string | null
          file_size_bytes: number | null
          published_at: string
          published_by: string | null
          is_active: boolean
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string
          resource_type: 'cuentacuento' | 'reflexion'
          liturgy_id?: string | null
          liturgy_date: string
          title: string
          description?: string | null
          pdf_url: string
          pdf_filename?: string | null
          file_size_bytes?: number | null
          published_at?: string
          published_by?: string | null
          is_active?: boolean
          created_at?: string
          updated_at?: string
        }
        Update: {
          id?: string
          resource_type?: 'cuentacuento' | 'reflexion'
          liturgy_id?: string | null
          liturgy_date?: string
          title?: string
          description?: string | null
          pdf_url?: string
          pdf_filename?: string | null
          file_size_bytes?: number | null
          published_at?: string
          published_by?: string | null
          is_active?: boolean
          created_at?: string
          updated_at?: string
        }
        Relationships: []
      }
      // PROMPT_004: Sermon music tracks table
      sermon_music_tracks: {
        Row: {
          id: string
          name: string
          type: 'intro' | 'outro'
          audio_url: string
          duration_seconds: number | null
          is_default: boolean
          created_by: string | null
          created_at: string
        }
        Insert: {
          id?: string
          name: string
          type: 'intro' | 'outro'
          audio_url: string
          duration_seconds?: number | null
          is_default?: boolean
          created_by?: string | null
          created_at?: string
        }
        Update: {
          id?: string
          name?: string
          type?: 'intro' | 'outro'
          audio_url?: string
          duration_seconds?: number | null
          is_default?: boolean
          created_by?: string | null
          created_at?: string
        }
        Relationships: []
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      is_mesa_admin: {
        Args: {
          user_uuid: string
        }
        Returns: boolean
      }
      // PROMPT_004: Set music track as default
      set_music_track_as_default: {
        Args: {
          track_id: string
        }
        Returns: undefined
      }
    }
    Enums: {
      mesa_abierta_month_status: 'open' | 'matching' | 'matched' | 'completed'
      mesa_abierta_role: 'host' | 'guest'
      mesa_abierta_participant_status: 'pending' | 'confirmed' | 'cancelled' | 'waitlist'
      mesa_abierta_food_assignment: 'main_course' | 'salad' | 'drinks' | 'dessert' | 'none'
      mesa_abierta_dietary_type: 'vegetarian' | 'vegan' | 'gluten_free' | 'dairy_free' | 'nut_allergy' | 'shellfish_allergy' | 'other'
      mesa_abierta_dietary_severity: 'preference' | 'allergy' | 'religious'
      mesa_abierta_email_type: 'confirmation' | 'assignment' | 'reminder' | 'cancellation' | 'custom'
      mesa_abierta_message_status: 'queued' | 'sent' | 'delivered' | 'failed' | 'bounced' | 'undelivered'
      mesa_abierta_whatsapp_type: 'confirmation' | 'reminder_7days' | 'reminder_1day' | 'assignment_host' | 'assignment_guest' | 'feedback_request' | 'emergency' | 'custom'
      mesa_abierta_admin_role: 'super_admin' | 'coordinator'
      graphics_format_v2: 'ppt_4_3' | 'instagram_post' | 'instagram_story' | 'facebook_post'
      graphics_event_type: 'mesa_abierta' | 'culto_dominical' | 'estudio_biblico' | 'retiro' | 'navidad' | 'cuaresma' | 'pascua' | 'bautismo' | 'comunidad' | 'musica' | 'oracion' | 'generic'
    }
    CompositeTypes: {
      [_ in never]: never
    }
  }
}

type PublicSchema = Database[Extract<keyof Database, "public">]

export type Tables<
  PublicTableNameOrOptions extends
    | keyof (PublicSchema["Tables"] & PublicSchema["Views"])
    | { schema: keyof Database },
  TableName extends PublicTableNameOrOptions extends { schema: keyof Database }
    ? keyof (Database[PublicTableNameOrOptions["schema"]]["Tables"] &
        Database[PublicTableNameOrOptions["schema"]]["Views"])
    : never = never,
> = PublicTableNameOrOptions extends { schema: keyof Database }
  ? (Database[PublicTableNameOrOptions["schema"]]["Tables"] &
      Database[PublicTableNameOrOptions["schema"]]["Views"])[TableName] extends {
      Row: infer R
    }
    ? R
    : never
  : PublicTableNameOrOptions extends keyof (PublicSchema["Tables"] &
        PublicSchema["Views"])
    ? (PublicSchema["Tables"] &
        PublicSchema["Views"])[PublicTableNameOrOptions] extends {
        Row: infer R
      }
      ? R
      : never
    : never

export type TablesInsert<
  PublicTableNameOrOptions extends
    | keyof PublicSchema["Tables"]
    | { schema: keyof Database },
  TableName extends PublicTableNameOrOptions extends { schema: keyof Database }
    ? keyof Database[PublicTableNameOrOptions["schema"]]["Tables"]
    : never = never,
> = PublicTableNameOrOptions extends { schema: keyof Database }
  ? Database[PublicTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Insert: infer I
    }
    ? I
    : never
  : PublicTableNameOrOptions extends keyof PublicSchema["Tables"]
    ? PublicSchema["Tables"][PublicTableNameOrOptions] extends {
        Insert: infer I
      }
      ? I
      : never
    : never

export type TablesUpdate<
  PublicTableNameOrOptions extends
    | keyof PublicSchema["Tables"]
    | { schema: keyof Database },
  TableName extends PublicTableNameOrOptions extends { schema: keyof Database }
    ? keyof Database[PublicTableNameOrOptions["schema"]]["Tables"]
    : never = never,
> = PublicTableNameOrOptions extends { schema: keyof Database }
  ? Database[PublicTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Update: infer U
    }
    ? U
    : never
  : PublicTableNameOrOptions extends keyof PublicSchema["Tables"]
    ? PublicSchema["Tables"][PublicTableNameOrOptions] extends {
        Update: infer U
      }
      ? U
      : never
    : never

export type Enums<
  PublicEnumNameOrOptions extends
    | keyof PublicSchema["Enums"]
    | { schema: keyof Database },
  EnumName extends PublicEnumNameOrOptions extends { schema: keyof Database }
    ? keyof Database[PublicEnumNameOrOptions["schema"]]["Enums"]
    : never = never,
> = PublicEnumNameOrOptions extends { schema: keyof Database }
  ? Database[PublicEnumNameOrOptions["schema"]]["Enums"][EnumName]
  : PublicEnumNameOrOptions extends keyof PublicSchema["Enums"]
    ? PublicSchema["Enums"][PublicEnumNameOrOptions]
    : never

export type CompositeTypes<
  PublicCompositeTypeNameOrOptions extends
    | keyof PublicSchema["CompositeTypes"]
    | { schema: keyof Database },
  CompositeTypeName extends PublicCompositeTypeNameOrOptions extends {
    schema: keyof Database
  }
    ? keyof Database[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"]
    : never = never,
> = PublicCompositeTypeNameOrOptions extends { schema: keyof Database }
  ? Database[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"][CompositeTypeName]
  : PublicCompositeTypeNameOrOptions extends keyof PublicSchema["CompositeTypes"]
    ? PublicSchema["CompositeTypes"][PublicCompositeTypeNameOrOptions]
    : never
