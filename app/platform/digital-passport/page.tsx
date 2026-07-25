import type { Metadata } from "next";
import MarketingNavbar from "@/components/MarketingNavbar";
import MarketingFooter from "@/components/MarketingFooter";
import DigitalPassport from "@/components/marketing/DigitalPassport";

export const metadata: Metadata = {
  title: "Digital Passport — SpaceSnap",
  description:
    "Prove it once, work anywhere. A portable, verified record of what you're trained on and cleared to do — issued by the space operators, equipment manufacturers and experts who signed you off.",
};

export default function Page() {
  return (
    <div className="flex flex-col min-h-screen bg-background">
      <MarketingNavbar />
      <DigitalPassport />
      <MarketingFooter />
    </div>
  );
}
