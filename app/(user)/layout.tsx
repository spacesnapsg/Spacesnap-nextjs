import UserNavbar from "@/components/UserNavbar";
import RoleGuard from "@/components/RoleGuard";
import PendingBookingCreditModal from "@/components/PendingBookingCreditModal";

export default function UserLayout({ children }: { children: React.ReactNode }) {
  return (
    <RoleGuard guard="user">
      <div className="min-h-screen bg-background text-body-text font-sans">
        <UserNavbar />
        <PendingBookingCreditModal />
        {children}
      </div>
    </RoleGuard>
  );
}
