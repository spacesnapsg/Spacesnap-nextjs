import type { Metadata } from "next";
import MarketingNavbar from "@/components/MarketingNavbar";
import MarketingFooter from "@/components/MarketingFooter";
import MarketplaceFeatures from "@/components/marketing/MarketplaceFeatures";

export const metadata: Metadata = {
  title: "Marketplace — SpaceSnap",
  description:
    "Space on demand. We plug your company into the underused assets of every other company — labs, cold storage, benches, desks — and turn them into capacity you can book today.",
};

export default function Page() {
  return (
    <div className="flex flex-col min-h-screen bg-background">
      <MarketingNavbar />
      <MarketplaceFeatures />
      <MarketingFooter />
    </div>
  );
}
