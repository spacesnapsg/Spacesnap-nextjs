export interface MonthlyRevenue {
  month: string;
  revenue: number;
}

export const MOCK_MONTHLY_REVENUE: MonthlyRevenue[] = [
  { month: "Feb", revenue: 18400 },
  { month: "Mar", revenue: 21200 },
  { month: "Apr", revenue: 19800 },
  { month: "May", revenue: 24500 },
  { month: "Jun", revenue: 27100 },
  { month: "Jul", revenue: 25460 },
];

export interface OperatorRevenue {
  company: string;
  revenue: number;
}

export const MOCK_REVENUE_BY_OPERATOR: OperatorRevenue[] = [
  { company: "LSI", revenue: 52300 },
  { company: "NSG BioLabs", revenue: 41850 },
  { company: "Co11ab", revenue: 33920 },
  { company: "NovaBio Therapeutics", revenue: 27640 },
  { company: "GeneLabs Inc.", revenue: 19310 },
];

export const MOCK_TOTAL_PLATFORM_REVENUE = 184920;
export const MOCK_TOTAL_COMPANIES = 96;
export const MOCK_TOTAL_TRANSACTIONS = 3868;

export type TransactionType = "credit" | "debit";

export interface AdminTransaction {
  id: number;
  user: string;
  company: string;
  description: string;
  type: TransactionType;
  amount: number;
  date: string;
}

export const MOCK_RECENT_TRANSACTIONS: AdminTransaction[] = [
  { id: 1, user: "Sarah Chen", company: "NovaBio Therapeutics", description: "Wet Lab Bench - Downtown SF", type: "debit", amount: 280, date: "Jul 16, 2026" },
  { id: 2, user: "Marcus Webb", company: "GeneLabs Inc.", description: "Top Up Purchase", type: "credit", amount: 250, date: "Jul 16, 2026" },
  { id: 3, user: "Priya Nair", company: "NovaBio Therapeutics", description: "PCR Thermocycler Rental", type: "debit", amount: 30, date: "Jul 15, 2026" },
  { id: 4, user: "Tom Baker", company: "GeneLabs Inc.", description: "Top Up Purchase", type: "credit", amount: 500, date: "Jul 15, 2026" },
  { id: 5, user: "Dana Kim", company: "CellWorks Bio", description: "BSL-2 Research Suite", type: "debit", amount: 1400, date: "Jul 14, 2026" },
  { id: 6, user: "Alex Rivera", company: "BioForge Labs", description: "Nitrile Gloves (Case of 100)", type: "debit", amount: 45, date: "Jul 14, 2026" },
  { id: 7, user: "Jordan Lee", company: "NovaBio Therapeutics", description: "Top Up Purchase", type: "credit", amount: 300, date: "Jul 13, 2026" },
  { id: 8, user: "Sofia Ramirez", company: "GeneLabs Inc.", description: "Centrifuge Rental", type: "debit", amount: 120, date: "Jul 12, 2026" },
  { id: 9, user: "Ben Foster", company: "Helix Diagnostics", description: "Top Up Purchase", type: "credit", amount: 100, date: "Jul 11, 2026" },
  { id: 10, user: "Grace Kim", company: "CellWorks Bio", description: "Cold Storage Unit - 1 Week", type: "debit", amount: 210, date: "Jul 10, 2026" },
  { id: 11, user: "Josh Whitfield", company: "Quantum Biosciences", description: "Top Up Purchase", type: "credit", amount: 400, date: "Jul 9, 2026" },
  { id: 12, user: "Aisha Bello", company: "Quantum Biosciences", description: "Biosafety Cabinet Rental", type: "debit", amount: 175, date: "Jul 8, 2026" },
];
