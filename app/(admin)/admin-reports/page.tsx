import { FileBarChart } from "lucide-react";
import Card from "@/components/Card";

// Shell only — route + page chrome, no report content yet.
export default function AdminReportsPage() {
  return (
    <div className="max-w-7xl mx-auto px-4 md:px-6 py-8">
      <div className="mb-8">
        <h1 className="text-3xl sm:text-4xl font-extrabold bg-gradient-to-r from-admin-red-start to-admin-orange-end bg-clip-text text-transparent">
          Reports
        </h1>
        <p className="text-muted-text mt-1">Platform reporting for admins.</p>
      </div>

      <Card className="flex flex-col items-center text-center py-16">
        <span className="h-12 w-12 rounded-full bg-admin-red-start/10 flex items-center justify-center mb-4">
          <FileBarChart size={20} className="text-admin-orange-end" />
        </span>
        <p className="text-sm font-medium text-body-text">Coming soon</p>
        <p className="text-sm text-muted-text mt-1 max-w-sm">
          Downloadable and on-screen reports will appear here.
        </p>
      </Card>
    </div>
  );
}
