import SupplierNavbar from "@/components/SupplierNavbar";
import RoleGuard from "@/components/RoleGuard";
import AnnouncementBanner from "@/components/AnnouncementBanner";
import EdmPopupModal from "@/components/EdmPopupModal";

export default function SupplierLayout({ children }: { children: React.ReactNode }) {
  return (
    <RoleGuard guard="supplier">
      <div className="min-h-screen bg-background text-body-text font-sans">
        <SupplierNavbar />
        <AnnouncementBanner portal="supplier" />
        <EdmPopupModal />
        {children}
      </div>
    </RoleGuard>
  );
}
