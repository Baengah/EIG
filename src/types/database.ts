export type Json = string | number | boolean | null | { [key: string]: Json | undefined } | Json[];

export type Database = {
  public: {
    Tables: {
      profiles: {
        Row: {
          id: string;
          full_name: string;
          email: string;
          phone: string | null;
          role: "admin" | "member" | "viewer";
          avatar_url: string | null;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id: string;
          full_name: string;
          email: string;
          phone?: string | null;
          role: "admin" | "member" | "viewer";
          avatar_url?: string | null;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          full_name?: string;
          email?: string;
          phone?: string | null;
          role?: "admin" | "member" | "viewer";
          avatar_url?: string | null;
          created_at?: string;
          updated_at?: string;
        };
        Relationships: [];
      };
      members: {
        Row: {
          id: string;
          profile_id: string | null;
          member_number: string;
          full_name: string;
          email: string;
          phone: string | null;
          join_date: string;
          is_active: boolean;
          bank_account_name: string | null;
          bank_name: string | null;
          bank_account_number: string | null;
          notes: string | null;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          profile_id?: string | null;
          member_number?: string;
          full_name: string;
          email: string;
          phone?: string | null;
          join_date: string;
          is_active: boolean;
          bank_account_name?: string | null;
          bank_name?: string | null;
          bank_account_number?: string | null;
          notes?: string | null;
        };
        Update: {
          id?: string;
          profile_id?: string | null;
          member_number?: string;
          full_name?: string;
          email?: string;
          phone?: string | null;
          join_date?: string;
          is_active?: boolean;
          bank_account_name?: string | null;
          bank_name?: string | null;
          bank_account_number?: string | null;
          notes?: string | null;
        };
        Relationships: [];
      };
      contribution_periods: {
        Row: {
          id: string;
          year: number;
          month: number;
          amount_per_member: number;
          due_date: string;
          notes: string | null;
          created_by: string | null;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          year: number;
          month: number;
          amount_per_member: number;
          due_date: string;
          notes?: string | null;
          created_by?: string | null;
        };
        Update: {
          id?: string;
          year?: number;
          month?: number;
          amount_per_member?: number;
          due_date?: string;
          notes?: string | null;
          created_by?: string | null;
        };
        Relationships: [];
      };
      contributions: {
        Row: {
          id: string;
          member_id: string;
          period_id: string;
          amount_paid: number | null;
          payment_date: string | null;
          payment_method: "bank_transfer" | "cash" | "online" | "other" | null;
          bank_reference: string | null;
          status: "pending" | "paid" | "partial" | "overdue" | "waived";
          document_id: string | null;
          notes: string | null;
          verified_by: string | null;
          verified_at: string | null;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          member_id: string;
          period_id: string;
          amount_paid?: number | null;
          payment_date?: string | null;
          payment_method?: "bank_transfer" | "cash" | "online" | "other" | null;
          bank_reference?: string | null;
          status: "pending" | "paid" | "partial" | "overdue" | "waived";
          document_id?: string | null;
          notes?: string | null;
          verified_by?: string | null;
          verified_at?: string | null;
        };
        Update: {
          id?: string;
          member_id?: string;
          period_id?: string;
          amount_paid?: number | null;
          payment_date?: string | null;
          payment_method?: "bank_transfer" | "cash" | "online" | "other" | null;
          bank_reference?: string | null;
          status?: "pending" | "paid" | "partial" | "overdue" | "waived";
          document_id?: string | null;
          notes?: string | null;
          verified_by?: string | null;
          verified_at?: string | null;
        };
        Relationships: [];
      };
      stocks: {
        Row: {
          id: string;
          ticker: string;
          company_name: string;
          sector: string | null;
          sub_sector: string | null;
          market_cap_category: "large" | "medium" | "small" | null;
          is_active: boolean;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          ticker: string;
          company_name: string;
          sector?: string | null;
          sub_sector?: string | null;
          market_cap_category?: "large" | "medium" | "small" | null;
          is_active?: boolean;
        };
        Update: {
          id?: string;
          ticker?: string;
          company_name?: string;
          sector?: string | null;
          sub_sector?: string | null;
          market_cap_category?: "large" | "medium" | "small" | null;
          is_active?: boolean;
        };
        Relationships: [];
      };
      mutual_funds: {
        Row: {
          id: string;
          fund_name: string;
          fund_code: string | null;
          fund_manager: string | null;
          fund_type: "equity" | "fixed_income" | "balanced" | "money_market" | "real_estate" | "ethical" | null;
          currency: string;
          is_active: boolean;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          fund_name: string;
          fund_code?: string | null;
          fund_manager?: string | null;
          fund_type?: "equity" | "fixed_income" | "balanced" | "money_market" | "real_estate" | "ethical" | null;
          currency?: string;
          is_active?: boolean;
        };
        Update: {
          id?: string;
          fund_name?: string;
          fund_code?: string | null;
          fund_manager?: string | null;
          fund_type?: "equity" | "fixed_income" | "balanced" | "money_market" | "real_estate" | "ethical" | null;
          currency?: string;
          is_active?: boolean;
        };
        Relationships: [];
      };
      holdings: {
        Row: {
          id: string;
          asset_type: "stock" | "mutual_fund";
          stock_id: string | null;
          mutual_fund_id: string | null;
          broker_account_id: string | null;
          quantity: number;
          average_cost: number;
          total_cost: number;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          asset_type: "stock" | "mutual_fund";
          stock_id?: string | null;
          mutual_fund_id?: string | null;
          broker_account_id?: string | null;
          quantity: number;
          average_cost: number;
        };
        Update: {
          id?: string;
          asset_type?: "stock" | "mutual_fund";
          stock_id?: string | null;
          mutual_fund_id?: string | null;
          broker_account_id?: string | null;
          quantity?: number;
          average_cost?: number;
        };
        Relationships: [];
      };
      transactions: {
        Row: {
          id: string;
          transaction_date: string;
          transaction_type: "buy" | "sell" | "dividend" | "rights_issue" | "bonus" | "transfer_in" | "transfer_out";
          asset_type: "stock" | "mutual_fund";
          stock_id: string | null;
          mutual_fund_id: string | null;
          broker_account_id: string | null;
          quantity: number | null;
          price: number | null;
          gross_amount: number | null;
          brokerage_fee: number;
          sec_fee: number;
          cscs_fee: number;
          stamp_duty: number;
          total_fees: number;
          net_amount: number | null;
          contract_note_number: string | null;
          document_id: string | null;
          settlement_date: string | null;
          notes: string | null;
          created_by: string | null;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          transaction_date: string;
          transaction_type: "buy" | "sell" | "dividend" | "rights_issue" | "bonus" | "transfer_in" | "transfer_out";
          asset_type: "stock" | "mutual_fund";
          stock_id?: string | null;
          mutual_fund_id?: string | null;
          broker_account_id?: string | null;
          quantity?: number | null;
          price?: number | null;
          gross_amount?: number | null;
          brokerage_fee?: number;
          sec_fee?: number;
          cscs_fee?: number;
          stamp_duty?: number;
          total_fees?: number;
          net_amount?: number | null;
          contract_note_number?: string | null;
          document_id?: string | null;
          settlement_date?: string | null;
          notes?: string | null;
          created_by?: string | null;
        };
        Update: {
          id?: string;
          transaction_date?: string;
          transaction_type?: "buy" | "sell" | "dividend" | "rights_issue" | "bonus" | "transfer_in" | "transfer_out";
          asset_type?: "stock" | "mutual_fund";
          stock_id?: string | null;
          mutual_fund_id?: string | null;
          broker_account_id?: string | null;
          quantity?: number | null;
          price?: number | null;
          gross_amount?: number | null;
          brokerage_fee?: number;
          sec_fee?: number;
          cscs_fee?: number;
          stamp_duty?: number;
          total_fees?: number;
          net_amount?: number | null;
          contract_note_number?: string | null;
          document_id?: string | null;
          settlement_date?: string | null;
          notes?: string | null;
          created_by?: string | null;
        };
        Relationships: [];
      };
      stock_prices: {
        Row: {
          id: string;
          stock_id: string;
          price_date: string;
          opening_price: number | null;
          high_price: number | null;
          low_price: number | null;
          closing_price: number;
          volume: number;
          value: number | null;
          trades: number | null;
          price_change: number | null;
          change_percent: number | null;
          scrape_source: string;
          created_at: string;
        };
        Insert: {
          id?: string;
          stock_id: string;
          price_date: string;
          opening_price?: number | null;
          high_price?: number | null;
          low_price?: number | null;
          closing_price: number;
          volume: number;
          value?: number | null;
          trades?: number | null;
          price_change?: number | null;
          change_percent?: number | null;
          scrape_source: string;
        };
        Update: {
          id?: string;
          stock_id?: string;
          price_date?: string;
          opening_price?: number | null;
          high_price?: number | null;
          low_price?: number | null;
          closing_price?: number;
          volume?: number;
          value?: number | null;
          trades?: number | null;
          price_change?: number | null;
          change_percent?: number | null;
          scrape_source?: string;
        };
        Relationships: [];
      };
      documents: {
        Row: {
          id: string;
          document_type: "bank_statement" | "contract_note" | "fund_statement" | "other";
          file_name: string;
          file_path: string;
          file_size: number | null;
          mime_type: string | null;
          upload_date: string;
          period_month: number | null;
          period_year: number | null;
          processing_status: "pending" | "processing" | "completed" | "failed";
          extracted_data: Json | null;
          processing_error: string | null;
          uploaded_by: string | null;
          notes: string | null;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          document_type: "bank_statement" | "contract_note" | "fund_statement" | "other";
          file_name: string;
          file_path: string;
          file_size?: number | null;
          mime_type?: string | null;
          upload_date?: string;
          period_month?: number | null;
          period_year?: number | null;
          processing_status?: "pending" | "processing" | "completed" | "failed";
          extracted_data?: Json | null;
          processing_error?: string | null;
          uploaded_by?: string | null;
          notes?: string | null;
        };
        Update: {
          id?: string;
          document_type?: "bank_statement" | "contract_note" | "fund_statement" | "other";
          file_name?: string;
          file_path?: string;
          file_size?: number | null;
          mime_type?: string | null;
          upload_date?: string;
          period_month?: number | null;
          period_year?: number | null;
          processing_status?: "pending" | "processing" | "completed" | "failed";
          extracted_data?: Json | null;
          processing_error?: string | null;
          uploaded_by?: string | null;
          notes?: string | null;
        };
        Relationships: [];
      };
      bank_accounts: {
        Row: {
          id: string;
          bank_name: string;
          account_name: string;
          account_number: string;
          account_type: string | null;
          currency: string;
          sort_code: string | null;
          is_active: boolean;
          is_primary: boolean;
          created_at: string;
        };
        Insert: {
          id?: string;
          bank_name: string;
          account_name: string;
          account_number: string;
          account_type?: string | null;
          currency?: string;
          sort_code?: string | null;
          is_active?: boolean;
          is_primary?: boolean;
        };
        Update: {
          id?: string;
          bank_name?: string;
          account_name?: string;
          account_number?: string;
          account_type?: string | null;
          currency?: string;
          sort_code?: string | null;
          is_active?: boolean;
          is_primary?: boolean;
        };
        Relationships: [];
      };
      member_contributions: {
        Row: {
          id: string;
          member_id: string;
          amount: number;
          contribution_date: string;
          payment_method: "bank_transfer" | "cash" | "online" | "other";
          bank_reference: string | null;
          notes: string | null;
          recorded_by: string | null;
          created_at: string;
        };
        Insert: {
          id?: string;
          member_id: string;
          amount: number;
          contribution_date: string;
          payment_method?: "bank_transfer" | "cash" | "online" | "other";
          bank_reference?: string | null;
          notes?: string | null;
          recorded_by?: string | null;
        };
        Update: {
          id?: string;
          member_id?: string;
          amount?: number;
          contribution_date?: string;
          payment_method?: "bank_transfer" | "cash" | "online" | "other";
          bank_reference?: string | null;
          notes?: string | null;
          recorded_by?: string | null;
        };
        Relationships: [];
      };
      bank_ledger: {
        Row: {
          id: string;
          entry_date: string;
          description: string;
          amount: number;
          category: "interest_income" | "bank_charge" | "tax" | "broker_transfer" | "other_income" | "other_expense";
          bank_account_id: string | null;
          bank_reference: string | null;
          notes: string | null;
          created_at: string;
        };
        Insert: {
          id?: string;
          entry_date: string;
          description: string;
          amount: number;
          category: "interest_income" | "bank_charge" | "tax" | "broker_transfer" | "other_income" | "other_expense";
          bank_account_id?: string | null;
          bank_reference?: string | null;
          notes?: string | null;
        };
        Update: {
          id?: string;
          entry_date?: string;
          description?: string;
          amount?: number;
          category?: "interest_income" | "bank_charge" | "tax" | "broker_transfer" | "other_income" | "other_expense";
          bank_account_id?: string | null;
          bank_reference?: string | null;
          notes?: string | null;
        };
        Relationships: [];
      };
      broker_accounts: {
        Row: {
          id: string;
          broker_name: string;
          account_number: string;
          account_name: string;
          currency: string;
          cash_balance: number;
          is_active: boolean;
          is_primary: boolean;
          created_at: string;
        };
        Insert: {
          id?: string;
          broker_name: string;
          account_number: string;
          account_name: string;
          currency?: string;
          cash_balance?: number;
          is_active?: boolean;
          is_primary?: boolean;
        };
        Update: {
          id?: string;
          broker_name?: string;
          account_number?: string;
          account_name?: string;
          currency?: string;
          cash_balance?: number;
          is_active?: boolean;
          is_primary?: boolean;
        };
        Relationships: [];
      };
      ledger_categories: {
        Row: {
          id: string;
          code: string;
          type: "income" | "cost" | "transfer";
          display_name: string;
          description: string | null;
          is_active: boolean;
          sort_order: number;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          code: string;
          type: "income" | "cost" | "transfer";
          display_name: string;
          description?: string | null;
          is_active?: boolean;
          sort_order?: number;
        };
        Update: {
          id?: string;
          code?: string;
          type?: "income" | "cost" | "transfer";
          display_name?: string;
          description?: string | null;
          is_active?: boolean;
          sort_order?: number;
          updated_at?: string;
        };
        Relationships: [];
      };
      unmatched_bank_entries: {
        Row: {
          id: string;
          entry_date: string;
          description: string;
          amount: number;
          bank_reference: string | null;
          notes: string | null;
          status: "pending" | "resolved" | "ignored";
          resolved_as: "contribution" | "interest_income" | "other_income" | "bank_charge" | "tax" | "other_expense" | "broker_transfer" | "ignored" | null;
          resolved_at: string | null;
          created_at: string;
        };
        Insert: {
          id?: string;
          entry_date: string;
          description: string;
          amount: number;
          bank_reference?: string | null;
          notes?: string | null;
          status?: "pending" | "resolved" | "ignored";
          resolved_as?: "contribution" | "interest_income" | "other_income" | "bank_charge" | "tax" | "other_expense" | "broker_transfer" | "ignored" | null;
          resolved_at?: string | null;
        };
        Update: {
          id?: string;
          entry_date?: string;
          description?: string;
          amount?: number;
          bank_reference?: string | null;
          notes?: string | null;
          status?: "pending" | "resolved" | "ignored";
          resolved_as?: "contribution" | "interest_income" | "other_income" | "bank_charge" | "tax" | "other_expense" | "broker_transfer" | "ignored" | null;
          resolved_at?: string | null;
        };
        Relationships: [];
      };
      portfolio_snapshots: {
        Row: {
          id: string;
          snapshot_date: string;
          total_value: number;
          total_cost: number;
          total_gain_loss: number;
          gain_loss_percent: number | null;
          stock_value: number;
          mutual_fund_value: number;
          cash_value: number;
          total_contributions: number;
          snapshot_detail: Json | null;
          created_at: string;
        };
        Insert: {
          id?: string;
          snapshot_date: string;
          total_value: number;
          total_cost: number;
          gain_loss_percent?: number | null;
          stock_value?: number;
          mutual_fund_value?: number;
          cash_value?: number;
          total_contributions?: number;
          snapshot_detail?: Json | null;
        };
        Update: {
          id?: string;
          snapshot_date?: string;
          total_value?: number;
          total_cost?: number;
          gain_loss_percent?: number | null;
          stock_value?: number;
          mutual_fund_value?: number;
          cash_value?: number;
          total_contributions?: number;
          snapshot_detail?: Json | null;
        };
        Relationships: [];
      };
    };
    Views: {
      v_holdings_with_value: {
        Row: {
          id: string;
          asset_type: "stock" | "mutual_fund";
          stock_id: string | null;
          mutual_fund_id: string | null;
          broker_account_id: string | null;
          quantity: number;
          average_cost: number;
          total_cost: number;
          ticker: string | null;
          company_name: string | null;
          sector: string | null;
          fund_name: string | null;
          fund_manager: string | null;
          fund_type: string | null;
          current_price: number | null;
          price_date: string | null;
          current_value: number;
          unrealized_gain_loss: number;
          gain_loss_percent: number;
          created_at: string;
          updated_at: string;
        };
        Relationships: [];
      };
      v_portfolio_summary: {
        Row: {
          total_positions: number;
          total_cost: number;
          total_value: number;
          total_unrealized_gain_loss: number;
          overall_gain_loss_percent: number;
          stock_value: number;
          fund_value: number;
        };
        Relationships: [];
      };
      v_contribution_status: {
        Row: {
          member_id: string;
          member_number: string;
          full_name: string;
          email: string;
          is_active: boolean;
          period_id: string;
          year: number;
          month: number;
          amount_per_member: number;
          due_date: string;
          contribution_id: string | null;
          amount_paid: number | null;
          payment_date: string | null;
          payment_method: string | null;
          status: string | null;
          paid_amount: number;
          outstanding_amount: number;
        };
        Relationships: [];
      };
    };
    Functions: {
      create_portfolio_snapshot: {
        Args: { p_date?: string };
        Returns: string;
      };
      is_admin: {
        Args: Record<string, never>;
        Returns: boolean;
      };
      is_member: {
        Args: Record<string, never>;
        Returns: boolean;
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

// Convenience type aliases
export type Profile = Database["public"]["Tables"]["profiles"]["Row"];
export type Member = Database["public"]["Tables"]["members"]["Row"];
export type ContributionPeriod = Database["public"]["Tables"]["contribution_periods"]["Row"];
export type Contribution = Database["public"]["Tables"]["contributions"]["Row"];
export type Stock = Database["public"]["Tables"]["stocks"]["Row"];
export type MutualFund = Database["public"]["Tables"]["mutual_funds"]["Row"];
export type Holding = Database["public"]["Tables"]["holdings"]["Row"];
export type Transaction = Database["public"]["Tables"]["transactions"]["Row"];
export type StockPrice = Database["public"]["Tables"]["stock_prices"]["Row"];
export type Document = Database["public"]["Tables"]["documents"]["Row"];
export type PortfolioSnapshot = Database["public"]["Tables"]["portfolio_snapshots"]["Row"];
export type BankAccount = Database["public"]["Tables"]["bank_accounts"]["Row"];
export type BrokerAccount = Database["public"]["Tables"]["broker_accounts"]["Row"];
export type BankLedgerEntry = Database["public"]["Tables"]["bank_ledger"]["Row"];
export type UnmatchedBankEntry = Database["public"]["Tables"]["unmatched_bank_entries"]["Row"];
export type LedgerCategory = Database["public"]["Tables"]["ledger_categories"]["Row"];
export type HoldingWithValue = Database["public"]["Views"]["v_holdings_with_value"]["Row"];
export type PortfolioSummary = Database["public"]["Views"]["v_portfolio_summary"]["Row"];
export type ContributionStatus = Database["public"]["Views"]["v_contribution_status"]["Row"];
