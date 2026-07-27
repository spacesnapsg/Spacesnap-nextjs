import { readFile } from "fs/promises";
import path from "path";
import { NextRequest, NextResponse } from "next/server";
import { renderToBuffer } from "@react-pdf/renderer";
import { auth } from "@/auth";
import { requireSystemAdmin } from "@/lib/admin-auth";
import { getBookingActivityReport } from "@/lib/reports/booking-activity";
import BookingActivityReportDocument from "@/lib/pdf/BookingActivityReportDocument";

function parseDateParam(value: string | null, endOfDay: boolean): Date | null {
  if (!value) return null;
  const date = new Date(`${value}T${endOfDay ? "23:59:59.999" : "00:00:00.000"}Z`);
  return Number.isNaN(date.getTime()) ? null : date;
}

export async function GET(request: NextRequest) {
  const authResult = await requireSystemAdmin();
  if ("error" in authResult) return authResult.error;

  const session = await auth();
  const generatedBy = session?.user?.name ?? session?.user?.email ?? "Admin";

  const { searchParams } = new URL(request.url);
  const fromParam = searchParams.get("from");
  const toParam = searchParams.get("to");
  const from = parseDateParam(fromParam, false);
  const to = parseDateParam(toParam, true);

  const report = await getBookingActivityReport(from, to);

  const logoPath = path.join(process.cwd(), "public", "logos", "logo-teal.png");
  const logoBuffer = await readFile(logoPath);
  const logoDataUri = `data:image/png;base64,${logoBuffer.toString("base64")}`;

  const pdfBuffer = await renderToBuffer(
    <BookingActivityReportDocument
      report={report}
      logoDataUri={logoDataUri}
      generatedAt={new Date()}
      generatedBy={generatedBy}
    />
  );

  const rangeSuffix = fromParam && toParam ? `${fromParam}_to_${toParam}` : "all-time";

  return new NextResponse(new Uint8Array(pdfBuffer), {
    headers: {
      "Content-Type": "application/pdf",
      "Content-Disposition": `attachment; filename="booking-activity-report-${rangeSuffix}.pdf"`,
    },
  });
}
