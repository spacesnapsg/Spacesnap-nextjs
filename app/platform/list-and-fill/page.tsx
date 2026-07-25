import type { Metadata } from "next";
import MarketingNavbar from "@/components/MarketingNavbar";
import MarketingFooter from "@/components/MarketingFooter";
import ListAndFill from "@/components/marketing/ListAndFill";

export const metadata: Metadata = {
  title: "List & Fill — SpaceSnap",
  description:
    "Your rooms are contracted. Your instruments are insured. Between tenants and between runs, they sit dark. List those idle days on SpaceSnap and they earn — with no new admin and no new risk on you.",
};

export default function Page() {
  return (
    <div className="flex flex-col min-h-screen bg-background">
      <MarketingNavbar accent="purple" />
      <ListAndFill />
      <MarketingFooter />
    </div>
  );
}
