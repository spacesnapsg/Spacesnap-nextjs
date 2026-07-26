import type { Metadata } from "next";
import MarketingNavbar from "@/components/MarketingNavbar";
import MarketingFooter from "@/components/MarketingFooter";
import WhySpaceSnap from "@/components/marketing/WhySpaceSnap";

export const metadata: Metadata = {
  title: "Why SpaceSnap? — SpaceSnap",
  description:
    "Book verified access to high-value instruments and regulated facilities by the session — no long-term commitment, no fit-out, no capex.",
};

export default function Page() {
  return (
    <div className="flex flex-col min-h-screen bg-background">
      <MarketingNavbar />
      <WhySpaceSnap />
      <MarketingFooter />
    </div>
  );
}
