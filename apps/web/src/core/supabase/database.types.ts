// core/supabase/database.types.ts
//
// GENERATED FILE — normally produced by:
//   supabase gen types typescript --local > src/core/supabase/database.types.ts
// Regenerate after every migration in supabase/migrations/. Do not hand-edit
// table shapes; hand-editing is only acceptable for the Json type helper below.
// This file currently reflects migrations 001 and 002.

export type Json = string | number | boolean | null | { [key: string]: Json | undefined } | Json[];

export interface Database {
  public: {
    Tables: {
      organizations: {
        Row: {
          id: string;
          name: string;
          slug: string;
          custom_domain: string | null;
          logo_url: string | null;
          favicon_url: string | null;
          primary_color: string;
          secondary_color: string;
          theme_mode_default: 'light' | 'dark' | 'system';
          subscription_plan: 'trial' | 'starter' | 'growth' | 'enterprise';
          subscription_status: 'active' | 'past_due' | 'suspended' | 'cancelled';
          billing_email: string | null;
          max_schools: number;
          max_students: number;
          settings: Json;
          created_at: string;
          updated_at: string;
          deleted_at: string | null;
        };
        Insert: Partial<Database['public']['Tables']['organizations']['Row']> & { name: string; slug: string };
        Update: Partial<Database['public']['Tables']['organizations']['Row']>;
      };
      schools: {
        Row: {
          id: string;
          organization_id: string;
          name: string;
          code: string;
          type: 'school' | 'college' | 'academy' | 'campus';
          address: string | null;
          city: string | null;
          state: string | null;
          country: string | null;
          postal_code: string | null;
          phone: string | null;
          email: string | null;
          logo_url: string | null;
          timezone: string;
          is_active: boolean;
          settings: Json;
          created_at: string;
          updated_at: string;
          deleted_at: string | null;
        };
        Insert: Partial<Database['public']['Tables']['schools']['Row']> & {
          organization_id: string;
          name: string;
          code: string;
        };
        Update: Partial<Database['public']['Tables']['schools']['Row']>;
      };
      profiles: {
        Row: {
          id: string;
          organization_id: string;
          full_name: string;
          email: string;
          phone: string | null;
          avatar_url: string | null;
          is_active: boolean;
          locale: string;
          theme_preference: 'light' | 'dark' | 'system';
          last_login_at: string | null;
          created_at: string;
          updated_at: string;
        };
        Insert: Partial<Database['public']['Tables']['profiles']['Row']> & {
          id: string;
          organization_id: string;
          full_name: string;
          email: string;
        };
        Update: Partial<Database['public']['Tables']['profiles']['Row']>;
      };
      roles: {
        Row: {
          id: string;
          organization_id: string | null;
          name: string;
          is_system: boolean;
          description: string | null;
          created_at: string;
          updated_at: string;
        };
        Insert: Partial<Database['public']['Tables']['roles']['Row']> & { name: string };
        Update: Partial<Database['public']['Tables']['roles']['Row']>;
      };
      permissions: {
        Row: { id: string; key: string; module: string; description: string; created_at: string };
        Insert: Partial<Database['public']['Tables']['permissions']['Row']> & { key: string; module: string; description: string };
        Update: Partial<Database['public']['Tables']['permissions']['Row']>;
      };
      role_permissions: {
        Row: { role_id: string; permission_id: string };
        Insert: { role_id: string; permission_id: string };
        Update: Partial<Database['public']['Tables']['role_permissions']['Row']>;
      };
      user_roles: {
        Row: { id: string; profile_id: string; role_id: string; school_id: string | null; created_at: string };
        Insert: Partial<Database['public']['Tables']['user_roles']['Row']> & { profile_id: string; role_id: string };
        Update: Partial<Database['public']['Tables']['user_roles']['Row']>;
      };
      audit_logs: {
        Row: {
          id: string;
          organization_id: string;
          school_id: string | null;
          actor_profile_id: string | null;
          action: string;
          table_name: string;
          row_id: string | null;
          before_data: Json | null;
          after_data: Json | null;
          ip_address: string | null;
          created_at: string;
        };
        Insert: Partial<Database['public']['Tables']['audit_logs']['Row']> & {
          organization_id: string;
          action: string;
          table_name: string;
        };
        Update: never;
      };
      notifications: {
        Row: {
          id: string;
          organization_id: string;
          school_id: string | null;
          recipient_profile_id: string | null;
          channel: 'in_app' | 'email' | 'sms' | 'whatsapp' | 'push';
          title: string;
          body: string;
          link_url: string | null;
          is_read: boolean;
          sent_at: string | null;
          created_at: string;
        };
        Insert: Partial<Database['public']['Tables']['notifications']['Row']> & {
          organization_id: string;
          title: string;
          body: string;
        };
        Update: Partial<Database['public']['Tables']['notifications']['Row']>;
      };
      platform_phases: {
        Row: { id: number; name: string; status: 'planned' | 'in_progress' | 'live'; completed_at: string | null };
        Insert: Database['public']['Tables']['platform_phases']['Row'];
        Update: Partial<Database['public']['Tables']['platform_phases']['Row']>;
      };
      academic_years: {
        Row: {
          id: string;
          school_id: string;
          name: string;
          start_date: string;
          end_date: string;
          is_current: boolean;
          created_at: string;
          updated_at: string;
        };
        Insert: Partial<Database['public']['Tables']['academic_years']['Row']> & {
          school_id: string;
          name: string;
          start_date: string;
          end_date: string;
        };
        Update: Partial<Database['public']['Tables']['academic_years']['Row']>;
      };
      classes: {
        Row: { id: string; school_id: string; academic_year_id: string; name: string; sequence: number; created_at: string };
        Insert: Partial<Database['public']['Tables']['classes']['Row']> & {
          school_id: string;
          academic_year_id: string;
          name: string;
        };
        Update: Partial<Database['public']['Tables']['classes']['Row']>;
      };
      sections: {
        Row: { id: string; class_id: string; name: string; capacity: number | null; room_number: string | null; created_at: string };
        Insert: Partial<Database['public']['Tables']['sections']['Row']> & { class_id: string; name: string };
        Update: Partial<Database['public']['Tables']['sections']['Row']>;
      };
    };
    Functions: {
      provision_organization: {
        Args: {
          p_user_id: string;
          p_user_email: string;
          p_user_full_name: string;
          p_org_name: string;
          p_org_slug: string;
          p_school_name: string;
          p_school_code: string;
        };
        Returns: { organization_id: string; school_id: string };
      };
      auth_organization_id: { Args: Record<string, never>; Returns: string };
      auth_has_permission: { Args: { perm_key: string }; Returns: boolean };
      auth_has_school_access: { Args: { target_school_id: string }; Returns: boolean };
    };
  };
}
