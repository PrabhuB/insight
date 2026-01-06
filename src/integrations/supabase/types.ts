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
      budget_history: {
        Row: {
          categories: Json
          created_at: string
          id: string
          month: number
          net_income: number
          remaining: number
          saved_at: string
          total_allocated: number
          updated_at: string
          user_id: string
          year: number
        }
        Insert: {
          categories?: Json
          created_at?: string
          id?: string
          month: number
          net_income?: number
          remaining?: number
          saved_at?: string
          total_allocated?: number
          updated_at?: string
          user_id: string
          year: number
        }
        Update: {
          categories?: Json
          created_at?: string
          id?: string
          month?: number
          net_income?: number
          remaining?: number
          saved_at?: string
          total_allocated?: number
          updated_at?: string
          user_id?: string
          year?: number
        }
        Relationships: []
      }
      deductions: {
        Row: {
          amount: number
          category: string
          created_at: string
          description: string | null
          id: string
          salary_record_id: string
        }
        Insert: {
          amount?: number
          category: string
          created_at?: string
          description?: string | null
          id?: string
          salary_record_id: string
        }
        Update: {
          amount?: number
          category?: string
          created_at?: string
          description?: string | null
          id?: string
          salary_record_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "deductions_salary_record_id_fkey"
            columns: ["salary_record_id"]
            isOneToOne: false
            referencedRelation: "salary_records"
            referencedColumns: ["id"]
          },
        ]
      }
      earnings: {
        Row: {
          amount: number
          category: string
          created_at: string
          description: string | null
          id: string
          salary_record_id: string
        }
        Insert: {
          amount?: number
          category: string
          created_at?: string
          description?: string | null
          id?: string
          salary_record_id: string
        }
        Update: {
          amount?: number
          category?: string
          created_at?: string
          description?: string | null
          id?: string
          salary_record_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "earnings_salary_record_id_fkey"
            columns: ["salary_record_id"]
            isOneToOne: false
            referencedRelation: "salary_records"
            referencedColumns: ["id"]
          },
        ]
      }
      employment_history: {
        Row: {
          created_at: string
          employee_id: string | null
          id: string
          joining_date: string
          leaving_date: string | null
          notes: string | null
          organization: string
          updated_at: string
          user_id: string
        }
        Insert: {
          created_at?: string
          employee_id?: string | null
          id?: string
          joining_date: string
          leaving_date?: string | null
          notes?: string | null
          organization: string
          updated_at?: string
          user_id: string
        }
        Update: {
          created_at?: string
          employee_id?: string | null
          id?: string
          joining_date?: string
          leaving_date?: string | null
          notes?: string | null
          organization?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      organization_templates: {
        Row: {
          created_at: string
          id: string
          name: string
          updated_at: string
          user_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          name: string
          updated_at?: string
          user_id: string
        }
        Update: {
          created_at?: string
          id?: string
          name?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      profiles: {
        Row: {
          bio: string | null
          created_at: string
          email: string | null
          full_name: string | null
          id: string
          job_title: string | null
          location: string | null
          updated_at: string
          username: string | null
        }
        Insert: {
          bio?: string | null
          created_at?: string
          email?: string | null
          full_name?: string | null
          id: string
          job_title?: string | null
          location?: string | null
          updated_at?: string
          username?: string | null
        }
        Update: {
          bio?: string | null
          created_at?: string
          email?: string | null
          full_name?: string | null
          id?: string
          job_title?: string | null
          location?: string | null
          updated_at?: string
          username?: string | null
        }
        Relationships: []
      }
      salary_records: {
        Row: {
          created_at: string
          gross_salary: number
          id: string
          month: number
          net_salary: number
          notes: string | null
          organization: string | null
          payslip_url: string | null
          total_deductions: number
          total_earnings: number
          updated_at: string
          user_id: string
          year: number
        }
        Insert: {
          created_at?: string
          gross_salary?: number
          id?: string
          month: number
          net_salary?: number
          notes?: string | null
          organization?: string | null
          payslip_url?: string | null
          total_deductions?: number
          total_earnings?: number
          updated_at?: string
          user_id: string
          year: number
        }
        Update: {
          created_at?: string
          gross_salary?: number
          id?: string
          month?: number
          net_salary?: number
          notes?: string | null
          organization?: string | null
          payslip_url?: string | null
          total_deductions?: number
          total_earnings?: number
          updated_at?: string
          user_id?: string
          year?: number
        }
        Relationships: []
      }
      template_deductions: {
        Row: {
          category: string
          created_at: string
          id: string
          template_id: string
        }
        Insert: {
          category: string
          created_at?: string
          id?: string
          template_id: string
        }
        Update: {
          category?: string
          created_at?: string
          id?: string
          template_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "template_deductions_template_id_fkey"
            columns: ["template_id"]
            isOneToOne: false
            referencedRelation: "organization_templates"
            referencedColumns: ["id"]
          },
        ]
      }
      template_earnings: {
        Row: {
          category: string
          created_at: string
          id: string
          template_id: string
        }
        Insert: {
          category: string
          created_at?: string
          id?: string
          template_id: string
        }
        Update: {
          category?: string
          created_at?: string
          id?: string
          template_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "template_earnings_template_id_fkey"
            columns: ["template_id"]
            isOneToOne: false
            referencedRelation: "organization_templates"
            referencedColumns: ["id"]
          },
        ]
      }
      user_account_locks: {
        Row: {
          is_locked: boolean
          reason: string | null
          updated_at: string
          user_id: string
        }
        Insert: {
          is_locked?: boolean
          reason?: string | null
          updated_at?: string
          user_id: string
        }
        Update: {
          is_locked?: boolean
          reason?: string | null
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      user_passcode_attempts: {
        Row: {
          failed_attempts: number
          last_attempt_at: string
          user_id: string
        }
        Insert: {
          failed_attempts?: number
          last_attempt_at?: string
          user_id: string
        }
        Update: {
          failed_attempts?: number
          last_attempt_at?: string
          user_id?: string
        }
        Relationships: []
      }
      user_passcodes: {
        Row: {
          created_at: string
          id: string
          passcode_hash: string
          updated_at: string
          user_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          passcode_hash: string
          updated_at?: string
          user_id: string
        }
        Update: {
          created_at?: string
          id?: string
          passcode_hash?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      user_roles: {
        Row: {
          id: string
          role: Database["public"]["Enums"]["app_role"]
          user_id: string
        }
        Insert: {
          id?: string
          role: Database["public"]["Enums"]["app_role"]
          user_id: string
        }
        Update: {
          id?: string
          role?: Database["public"]["Enums"]["app_role"]
          user_id?: string
        }
        Relationships: []
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      get_email_for_username: { Args: { p_username: string }; Returns: string }
      has_role: {
        Args: {
          _role: Database["public"]["Enums"]["app_role"]
          _user_id: string
        }
        Returns: boolean
      }
      set_passcode: { Args: { p_passcode: string }; Returns: undefined }
      verify_passcode: { Args: { p_passcode: string }; Returns: boolean }
      wipe_all_salary_data: { Args: never; Returns: undefined }
    }
    Enums: {
      app_role: "admin" | "user"
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
      app_role: ["admin", "user"],
    },
  },
} as const
