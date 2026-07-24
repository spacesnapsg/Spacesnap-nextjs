import MarketingNavbar from "./MarketingNavbar";
import MarketingFooter from "./MarketingFooter";

export default function MarketingPageShell({ title }: { title: string }) {
  return (
    <div className="flex flex-col min-h-screen bg-background text-body-text">
      <MarketingNavbar />
      <section className="flex-1 flex flex-col items-center justify-center text-center px-6 py-32">
        <h1 className="text-4xl font-medium text-white">{title}</h1>
        <p className="mt-4 text-muted-text max-w-md">
          This page is coming soon. In the meantime,{" "}
          <a
            href="mailto:spacesnapsg@gmail.com"
            className="text-user-teal-end underline"
          >
            get in touch
          </a>{" "}
          or head back to the homepage.
        </p>
      </section>
      <MarketingFooter />
    </div>
  );
}
