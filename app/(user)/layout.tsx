import UserNavbar from "@/components/UserNavbar";

export default function UserLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="min-h-screen bg-background text-body-text font-sans">
      <UserNavbar />
      {children}
    </div>
  );
}
