export type Json = string | number | boolean | null | { [key: string]: Json | undefined } | Json[];

export type Database = {
  public: {
    Tables: {
      calendars: {
        Row: {
          id: string;
          name: string;
          created_at: string;
        };
        Insert: {
          id?: string;
          name: string;
          created_at?: string;
        };
        Update: {
          id?: string;
          name?: string;
          created_at?: string;
        };
        Relationships: [];
      };
      habits: {
        Row: {
          id: string;
          calendar_id: string;
          name: string;
          slug: string;
          color: string;
          created_at: string;
        };
        Insert: {
          id?: string;
          calendar_id: string;
          name: string;
          slug: string;
          color?: string;
          created_at?: string;
        };
        Update: {
          id?: string;
          calendar_id?: string;
          name?: string;
          slug?: string;
          color?: string;
          created_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: "habits_calendar_id_fkey";
            columns: ["calendar_id"];
            referencedRelation: "calendars";
            referencedColumns: ["id"];
          },
        ];
      };
      habit_marks: {
        Row: {
          id: string;
          habit_id: string;
          mark_date: string;
          created_at: string;
        };
        Insert: {
          id?: string;
          habit_id: string;
          mark_date: string;
          created_at?: string;
        };
        Update: {
          id?: string;
          habit_id?: string;
          mark_date?: string;
          created_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: "habit_marks_habit_id_fkey";
            columns: ["habit_id"];
            referencedRelation: "habits";
            referencedColumns: ["id"];
          },
        ];
      };
    };
    Views: Record<string, never>;
    Functions: Record<string, never>;
    Enums: Record<string, never>;
    CompositeTypes: Record<string, never>;
  };
};

export type CalendarRow = Database["public"]["Tables"]["calendars"]["Row"];
export type HabitRow = Database["public"]["Tables"]["habits"]["Row"];
export type HabitMarkRow = Database["public"]["Tables"]["habit_marks"]["Row"];
