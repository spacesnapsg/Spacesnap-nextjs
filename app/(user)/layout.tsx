import UserNavbar from "@/components/UserNavbar";
import RoleGuard from "@/components/RoleGuard";
import PendingBookingCreditModal from "@/components/PendingBookingCreditModal";
import AnnouncementBanner from "@/components/AnnouncementBanner";
import EdmPopupModal from "@/components/EdmPopupModal";

export default function UserLayout({ children }: { children: React.ReactNode }) {
  return (
    <RoleGuard guard="user">
      <div className="min-h-screen bg-background text-body-text font-sans">
        <UserNavbar />
        <AnnouncementBanner portal="member" />
        <PendingBookingCreditModal />
        <EdmPopupModal />
        {children}
      </div>
    </RoleGuard>
  );
}
