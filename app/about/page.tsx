import type { Metadata } from "next";
import MarketingNavbar from "@/components/MarketingNavbar";
import MarketingFooter from "@/components/MarketingFooter";
import AboutUs from "@/components/marketing/AboutUs";

export const metadata: Metadata = {
  title: "About Us — SpaceSnap",
  description:
    "Why SpaceSnap exists: a founder's story of standing on both sides of a locked door, and building the portable, verifiable trust that opens it.",
};

export default function Page() {
  return (
    <div className="flex flex-col min-h-screen bg-background">
      <MarketingNavbar />
      <AboutUs />
      <MarketingFooter />
    </div>
  );
}
