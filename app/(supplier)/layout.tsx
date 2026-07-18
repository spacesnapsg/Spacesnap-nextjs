import SupplierNavbar from "@/components/SupplierNavbar";

export default function SupplierLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="min-h-screen bg-background text-body-text font-sans">
      <SupplierNavbar />
      {children}
    </div>
  );
}
