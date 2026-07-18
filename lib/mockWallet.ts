export type TransactionType = "credit" | "debit";

export interface CreditTransaction {
  id: number;
  type: TransactionType;
  description: string;
  date: string;
  amount: number;
}

export interface PaymentMethod {
  id: number;
  brand: string;
  last4: string;
  expiry: string;
  is_default: boolean;
}

export interface CreditPackage {
  id: number;
  credits: number;
  price: number;
}

export interface CurrentUserWallet {
  user_id: number;
  credit_balance: number;
}

export interface WalletStats {
  month_spend: number;
  month_spend_change_pct: number;
  avg_monthly_spend: number;
}

export const MOCK_CURRENT_USER_WALLET: CurrentUserWallet = {
  user_id: 1,
  credit_balance: 450,
};

export const MOCK_WALLET_STATS: WalletStats = {
  month_spend: 310,
  month_spend_change_pct: 12.5,
  avg_monthly_spend: 265,
};

export const MOCK_BALANCE_TREND: number[] = [320, 360, 340, 400, 380, 420, 450];

export const MOCK_PAYMENT_METHODS: PaymentMethod[] = [
  { id: 1, brand: "Visa", last4: "4242", expiry: "12/26", is_default: true },
  { id: 2, brand: "Mastercard", last4: "8821", expiry: "09/27", is_default: false },
];

export const MOCK_TRANSACTIONS: CreditTransaction[] = [
  { id: 1, type: "credit", description: "Top Up Purchase", date: "2026-07-12", amount: 250 },
  { id: 2, type: "debit", description: "Wet Lab Bench - Downtown SF", date: "2026-07-10", amount: 280 },
  { id: 3, type: "debit", description: "PCR Thermocycler Rental", date: "2026-07-08", amount: 30 },
  { id: 4, type: "credit", description: "Top Up Purchase", date: "2026-07-02", amount: 100 },
  { id: 5, type: "debit", description: "BSL-2 Research Suite", date: "2026-06-28", amount: 1400 },
  { id: 6, type: "debit", description: "Nitrile Gloves (Case of 100)", date: "2026-06-24", amount: 45 },
];

export const MOCK_CREDIT_PACKAGES: CreditPackage[] = [
  { id: 1, credits: 100, price: 50 },
  { id: 2, credits: 250, price: 110 },
  { id: 3, credits: 500, price: 200 },
  { id: 4, credits: 1000, price: 380 },
];
