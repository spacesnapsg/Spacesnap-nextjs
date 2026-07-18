export type UserRole = "user" | "supplier" | "company_admin" | "system_admin";
export type AccountStatus = "active" | "suspended";

export interface AdminUser {
  id: number;
  name: string;
  email: string;
  role: UserRole;
  company: string;
  memberSince: string;
  status: AccountStatus;
}

export interface CompanySupplier {
  name: string;
  email: string;
  status: AccountStatus;
}

export interface AdminCompany {
  id: number;
  name: string;
  suppliers: CompanySupplier[];
}

// TODO: replace with GET /api/admin/users once the backend admin panel is built.
export const MOCK_ADMIN_USERS: AdminUser[] = [
  { id: 1, name: "Sarah Chen", email: "sarah.chen@gmail.com", role: "user", company: "", memberSince: "Jan 2025", status: "active" },
  { id: 2, name: "Marcus Webb", email: "marcus.webb@gmail.com", role: "user", company: "", memberSince: "Feb 2025", status: "active" },
  { id: 3, name: "Priya Nair", email: "priya.nair@novabio.io", role: "supplier", company: "NovaBio Therapeutics", memberSince: "Mar 2025", status: "active" },
  { id: 4, name: "Tom Baker", email: "tom.baker@genelabs.com", role: "supplier", company: "GeneLabs Inc.", memberSince: "Nov 2024", status: "suspended" },
  { id: 5, name: "Dana Kim", email: "dana.kim@cellworks.bio", role: "supplier", company: "CellWorks Bio", memberSince: "Jun 2025", status: "active" },
  { id: 6, name: "Alex Rivera", email: "alex.rivera@stanford.edu", role: "user", company: "", memberSince: "Jul 2025", status: "suspended" },
  { id: 7, name: "Jordan Lee", email: "jordan.lee@novabio.io", role: "company_admin", company: "NovaBio Therapeutics", memberSince: "Jan 2024", status: "active" },
  { id: 8, name: "Sofia Ramirez", email: "sofia.ramirez@gene-labs.com", role: "company_admin", company: "GeneLabs Inc.", memberSince: "Feb 2024", status: "active" },
  { id: 9, name: "Ben Foster", email: "ben.foster@gmail.com", role: "user", company: "", memberSince: "Apr 2025", status: "active" },
  { id: 10, name: "Grace Kim", email: "grace.kim@cellworks.bio", role: "company_admin", company: "CellWorks Bio", memberSince: "May 2024", status: "suspended" },
  { id: 11, name: "Admin Root", email: "admin@spacesnap.io", role: "system_admin", company: "", memberSince: "Jan 2023", status: "active" },
  { id: 12, name: "Olivia Chen", email: "olivia.chen@spacesnap.io", role: "system_admin", company: "", memberSince: "Aug 2024", status: "active" },
];

// TODO: replace with GET /api/admin/companies (with nested supplier data) once the backend exists.
export const MOCK_ADMIN_COMPANIES: AdminCompany[] = [
  {
    id: 1,
    name: "NovaBio Therapeutics",
    suppliers: [
      { name: "Priya Nair", email: "priya.nair@novabio.io", status: "active" },
      { name: "Elena Vance", email: "elena.vance@novabio.io", status: "active" },
      { name: "Raj Patel", email: "raj.patel@novabio.io", status: "suspended" },
    ],
  },
  {
    id: 2,
    name: "GeneLabs Inc.",
    suppliers: [
      { name: "Tom Baker", email: "tom.baker@genelabs.com", status: "suspended" },
      { name: "Nina Alvarez", email: "nina.alvarez@genelabs.com", status: "active" },
    ],
  },
  {
    id: 3,
    name: "CellWorks Bio",
    suppliers: [
      { name: "Dana Kim", email: "dana.kim@cellworks.bio", status: "active" },
      { name: "Leo Martins", email: "leo.martins@cellworks.bio", status: "active" },
      { name: "Wendy Zhao", email: "wendy.zhao@cellworks.bio", status: "suspended" },
      { name: "Carlos Mendes", email: "carlos.mendes@cellworks.bio", status: "active" },
    ],
  },
  {
    id: 4,
    name: "BioForge Labs",
    suppliers: [
      { name: "Hannah Ortiz", email: "hannah.ortiz@bioforge.io", status: "active" },
      { name: "Derek Simmons", email: "derek.simmons@bioforge.io", status: "active" },
    ],
  },
  {
    id: 5,
    name: "Helix Diagnostics",
    suppliers: [
      { name: "Maria Gonzalez", email: "maria.gonzalez@helixdx.com", status: "active" },
      { name: "Sam Okafor", email: "sam.okafor@helixdx.com", status: "suspended" },
      { name: "Priya Desai", email: "priya.desai@helixdx.com", status: "active" },
      { name: "Tariq Hassan", email: "tariq.hassan@helixdx.com", status: "active" },
      { name: "Wei Chen", email: "wei.chen@helixdx.com", status: "suspended" },
    ],
  },
  {
    id: 6,
    name: "Quantum Biosciences",
    suppliers: [
      { name: "Josh Whitfield", email: "josh.whitfield@quantumbio.com", status: "active" },
      { name: "Aisha Bello", email: "aisha.bello@quantumbio.com", status: "active" },
      { name: "Peter Novak", email: "peter.novak@quantumbio.com", status: "active" },
    ],
  },
];
