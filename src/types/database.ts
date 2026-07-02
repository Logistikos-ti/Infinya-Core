export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[];

export type Database = {
  public: {
    Tables: {
      usuarios: {
        Row: {
          id: string;
          email: string;
          login: string;
          nome: string;
          papel: Database["public"]["Enums"]["papel_usuario"];
          depositante_id: string | null;
          ativo: boolean;
          ultimo_acesso_em: string | null;
          created_at: string;
          updated_at: string;
        };
      };
    };
    Views: Record<string, never>;
    Functions: {
      current_papel_usuario: {
        Args: Record<PropertyKey, never>;
        Returns: Database["public"]["Enums"]["papel_usuario"];
      };
      current_depositante_id: {
        Args: Record<PropertyKey, never>;
        Returns: string | null;
      };
      is_admin: {
        Args: Record<PropertyKey, never>;
        Returns: boolean;
      };
      can_access_depositante: {
        Args: { target_depositante_id: string };
        Returns: boolean;
      };
    };
    Enums: {
      papel_usuario: "ADMIN" | "TI" | "OPERADOR" | "DEPOSITANTE";
    };
    CompositeTypes: Record<string, never>;
  };
};
