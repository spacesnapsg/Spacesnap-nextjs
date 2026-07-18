import SupplierNavbar from "@/components/SupplierNavbar";
import RoleGuard from "@/components/RoleGuard";

export default function SupplierLayout({ children }: { children: React.ReactNode }) {
  return (
    <RoleGuard guard="supplier">
      <div className="min-h-screen bg-background text-body-text font-sans">
        <SupplierNavbar />
        {children}
      </div>
    </RoleGuard>
  );
}
