import UserNavbar from "@/components/UserNavbar";
import RoleGuard from "@/components/RoleGuard";

export default function UserLayout({ children }: { children: React.ReactNode }) {
  return (
    <RoleGuard guard="user">
      <div className="min-h-screen bg-background text-body-text font-sans">
        <UserNavbar />
        {children}
      </div>
    </RoleGuard>
  );
}
