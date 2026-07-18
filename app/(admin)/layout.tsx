import AdminNavbar from "@/components/AdminNavbar";

export default function AdminLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="min-h-screen bg-background text-body-text font-sans">
      <AdminNavbar />
      {children}
    </div>
  );
}
