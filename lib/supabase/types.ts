// SUPABASE: tipi del database generati manualmente dalla struttura della tabella stories.
// In futuro si può sostituire con tipi auto-generati tramite Supabase CLI:
// `pnpm supabase gen types typescript --linked > lib/supabase/types.ts`

// Tipo Json standard compatibile con Supabase v2 per colonne jsonb
export type Json = string | number | boolean | null | { [key: string]: Json | undefined } | Json[];

// SUPABASE: la struttura deve includere Views, Enums, CompositeTypes e Relationships
// altrimenti il client risolve Insert/Update come never
export type Database = {
  public: {
    Tables: {
      stories: {
        Row: {
          id: string;
          status: 'draft' | 'published';
          title: string;
          description: string;
          author_cookie_id: string;
          author_display_name: string | null;
          artwork_data: Json;
          image_source: string;
          waypoints: Json;
          cover_thumbnail: string | null;
          view_count: number;
          created_at: string;
          updated_at: string;
          published_at: string | null;
        };
        Insert: {
          id?: string;
          status?: 'draft' | 'published';
          title?: string;
          description?: string;
          author_cookie_id: string;
          author_display_name?: string | null;
          artwork_data: Json;
          image_source: string;
          waypoints?: Json;
          cover_thumbnail?: string | null;
          view_count?: number;
          created_at?: string;
          updated_at?: string;
          published_at?: string | null;
        };
        Update: {
          id?: string;
          status?: 'draft' | 'published';
          title?: string;
          description?: string;
          author_cookie_id?: string;
          author_display_name?: string | null;
          artwork_data?: Json;
          image_source?: string;
          waypoints?: Json;
          cover_thumbnail?: string | null;
          view_count?: number;
          updated_at?: string;
          published_at?: string | null;
        };
        Relationships: [];
      };
    };
    Views: {
      [_ in never]: never;
    };
    Functions: {
      increment_view_count: {
        Args: { story_id: string };
        Returns: undefined;
      };
    };
    Enums: {
      [_ in never]: never;
    };
    CompositeTypes: {
      [_ in never]: never;
    };
  };
};
