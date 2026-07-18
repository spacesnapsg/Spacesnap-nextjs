import AdminNavbar from "@/components/AdminNavbar";
import RoleGuard from "@/components/RoleGuard";

export default function AdminLayout({ children }: { children: React.ReactNode }) {
  return (
    <RoleGuard guard="systemAdmin">
      <div className="min-h-screen bg-background text-body-text font-sans">
        <AdminNavbar />
        {children}
      </div>
    </RoleGuard>
  );
}
