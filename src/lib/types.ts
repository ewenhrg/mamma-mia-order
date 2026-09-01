/**
 * Types de la base Supabase, ecrits a la main pour rester alignes sur
 * supabase/migrations/0001_init.sql. Si tu regeneres avec la CLI Supabase
 * (`supabase gen types typescript`), remplace ce fichier.
 */

export type StaffRole = 'server' | 'manager' | 'admin';
/** 'open' = table occupee (encaissee ou non). 'closed' = table liberee. */
export type OrderStatus = 'open' | 'paid' | 'cancelled' | 'closed';
/** 'requested' = commande client a valider. 'sent' = parti en cuisine. */
export type OrderItemStatus = 'requested' | 'sent';


export type StaffRow = {
  id: string;
  full_name: string;
  role: StaffRole;
  active: boolean;
  /** Nul tant que la premiere connexion n a pas abouti : le provisionnement
      est alors rejoue, ce qui evite qu un compte reste bloque. */
  provisioned_at: string | null;
  created_at: string;
  updated_at: string;
};

export type CategoryRow = {
  id: string;
  name: string;
  color: string;
  sort_order: number;
  active: boolean;
  created_at: string;
  updated_at: string;
};

export type ProductRow = {
  id: string;
  category_id: string;
  name: string;
  description: string | null;
  price_cents: number;
  image_url: string | null;
  available: boolean;
  sort_order: number;
  active: boolean;
  created_at: string;
  updated_at: string;
};

export type OptionGroupRow = {
  id: string;
  name: string;
  min_select: number;
  max_select: number;
  sort_order: number;
  created_at: string;
  updated_at: string;
};

export type OptionRow = {
  id: string;
  group_id: string;
  name: string;
  price_delta_cents: number;
  available: boolean;
  sort_order: number;
  created_at: string;
};

export type ProductOptionGroupRow = {
  product_id: string;
  group_id: string;
  sort_order: number;
};

/** Zone de salle. Editable depuis Admin > Tables, ce n'est plus un enum fige. */
export type ZoneRow = {
  id: string;
  name: string;
  color: string;
  sort_order: number;
  active: boolean;
  created_at: string;
  updated_at: string;
};

/** Zones qu un serveur a le droit de voir. Aucune ligne = toute la salle. */
export type StaffZoneRow = {
  staff_id: string;
  zone_id: string;
};

export type RestaurantTableRow = {
  id: string;
  label: string;
  zone_id: string;
  seats: number;
  sort_order: number;
  active: boolean;
  /** Secret du QR client. Nul tant que la migration 0007 n'est pas passee. */
  guest_token: string | null;
  created_at: string;
  updated_at: string;
};

export type OrderRow = {
  id: string;
  order_number: number;
  table_id: string;
  status: OrderStatus;
  opened_by: string | null;
  subtotal_cents: number;
  discount_cents: number;
  total_cents: number;
  note: string | null;
  /** Horodatage de l'encaissement. La table reste occupee apres paiement. */
  paid_at: string | null;
  paid_by: string | null;
  /** Montant reellement encaisse ; total_cents peut repasser au-dessus. */
  paid_amount_cents: number;
  created_at: string;
  updated_at: string;
  closed_at: string | null;
};

export type OrderItemOptionSnapshot = {
  id: string;
  name: string;
  price_delta_cents: number;
};

export type OrderItemRow = {
  id: string;
  order_id: string;
  batch_id: string;
  product_id: string | null;
  name_snapshot: string;
  base_price_cents: number;
  options_snapshot: OrderItemOptionSnapshot[];
  unit_price_cents: number;
  quantity: number;
  line_total_cents: number;
  note: string | null;
  created_by: string | null;
  from_guest?: boolean;
  /** Absent tant que la migration 0008 n'est pas passee : alors la ligne est deja envoyee. */
  status?: OrderItemStatus;
  /** Horodatage d'envoi en cuisine. Nul tant que la ligne est demandee. */
  sent_at?: string | null;
  created_at: string;
};

export type TableOverviewRow = {
  id: string;
  label: string;
  zone_id: string;
  zone_name: string;
  zone_color: string;
  seats: number;
  sort_order: number;
  order_id: string | null;
  order_number: number | null;
  order_total_cents: number | null;
  order_opened_at: string | null;
  order_opened_by: string | null;
  order_opened_by_name: string | null;
  order_paid_at: string | null;
  order_paid_amount_cents: number | null;
  order_remaining_cents: number | null;
  item_count: number;
  /** Articles client encore a valider. 0 si la migration 0008 n'est pas passee. */
  requested_count?: number;
};

/** Payload envoye a pos_submit_order : jamais de prix, uniquement des ids. */
export type SubmitItemPayload = {
  product_id: string;
  quantity: number;
  option_ids: string[];
  note: string | null;
};

export type SubmitOrderResult = {
  ok: true;
  duplicate: boolean;
  order_id: string;
  order_number: number;
  batch_id: string;
  created: boolean;
  items_added: number;
  subtotal_cents: number;
  total_cents: number;
};

type Table<Row, Insert = Partial<Row>, Update = Partial<Row>> = {
  Row: Row;
  Insert: Insert;
  Update: Update;
  Relationships: [];
};

export type Database = {
  public: {
    Tables: {
      staff: Table<StaffRow>;
      categories: Table<CategoryRow>;
      products: Table<ProductRow>;
      option_groups: Table<OptionGroupRow>;
      options: Table<OptionRow>;
      product_option_groups: Table<ProductOptionGroupRow>;
      restaurant_tables: Table<RestaurantTableRow>;
      zones: Table<ZoneRow>;
      orders: Table<OrderRow>;
      order_items: Table<OrderItemRow>;
      staff_zones: Table<StaffZoneRow>;
    };
    Views: {
      table_overview: { Row: TableOverviewRow; Relationships: [] };
    };
    Functions: {
      pos_submit_order: {
        Args: {
          p_client_request_id: string;
          p_table_id: string;
          p_items: SubmitItemPayload[];
          p_order_note?: string | null;
        };
        Returns: SubmitOrderResult;
      };
      guest_resolve_table: {
        Args: { p_token: string };
        Returns: { id: string; label: string }[];
      };
      guest_submit_order: {
        Args: {
          p_table_token: string;
          p_client_request_id: string;
          p_items: SubmitItemPayload[];
          p_order_note?: string | null;
        };
        Returns: SubmitOrderResult;
      };
      pos_mark_paid: {
        Args: { p_order_id: string; p_discount_cents?: number };
        Returns: {
          ok: true;
          order_id: string;
          status: OrderStatus;
          paid_at: string;
          paid_amount_cents: number;
          total_cents: number;
          remaining_cents: number;
        };
      };
      pos_unmark_paid: {
        Args: { p_order_id: string };
        Returns: { ok: true; order_id: string; paid_at: null };
      };
      pos_release_table: {
        Args: { p_order_id: string };
        Returns: { ok: true; duplicate: boolean; status: OrderStatus };
      };
      pos_cancel_order: {
        Args: { p_order_id: string };
        Returns: { ok: true; duplicate: boolean; status: OrderStatus };
      };
      pos_void_item: {
        Args: { p_item_id: string };
        Returns: { ok: true; duplicate: boolean; order_id?: string };
      };
      pos_accept_guest_items: {
        Args: { p_order_id: string };
        Returns: {
          ok: true;
          duplicate: boolean;
          order_id: string;
          order_number: number;
          batch_id: string;
          items_accepted: number;
        };
      };
      pos_force_release: {
        Args: { p_order_id: string };
        Returns: { ok: true; duplicate: boolean; status: OrderStatus };
      };
      pos_delete_table: { Args: { p_table_id: string }; Returns: { ok: true; deleted: boolean } };
      pos_delete_category: { Args: { p_category_id: string }; Returns: { ok: true; deleted: boolean } };
      pos_delete_product: { Args: { p_product_id: string }; Returns: { ok: true; deleted: boolean } };
      pos_delete_zone: { Args: { p_zone_id: string }; Returns: { ok: true; deleted: boolean } };
      pos_set_staff_zones: {
        Args: { p_staff_id: string; p_zone_ids: string[] };
        Returns: { ok: true; zone_count: number };
      };
    };
    Enums: {
      staff_role: StaffRole;
      order_status: OrderStatus;
      order_item_status: OrderItemStatus;
    };
    CompositeTypes: Record<string, never>;
  };
};

// ---------------------------------------------------------------------------
// Types applicatifs (menu denormalise pour un rendu rapide)
// ---------------------------------------------------------------------------

export type MenuOption = {
  id: string;
  name: string;
  priceDeltaCents: number;
};

export type MenuOptionGroup = {
  id: string;
  name: string;
  minSelect: number;
  maxSelect: number; // 0 = illimite
  options: MenuOption[];
};

export type MenuProduct = {
  id: string;
  categoryId: string;
  name: string;
  description: string | null;
  priceCents: number;
  imageUrl: string | null;
  available: boolean;
  /** Precalcule au chargement : evite un test au rendu de chaque carte. */
  hasOptions: boolean;
  optionGroups: MenuOptionGroup[];
  /** Nom normalise, precalcule pour la recherche instantanee. */
  searchKey: string;
};

export type MenuCategory = {
  id: string;
  name: string;
  color: string;
  productCount: number;
};

export type Menu = {
  categories: MenuCategory[];
  products: MenuProduct[];
};
