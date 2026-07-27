import { Document, Page, View, Text, Image, StyleSheet } from "@react-pdf/renderer";
import type { BookingActivityReport } from "@/lib/reports/booking-activity";

const styles = StyleSheet.create({
  page: { paddingTop: 40, paddingBottom: 60, paddingHorizontal: 40, fontSize: 9, fontFamily: "Helvetica", color: "#1a1a1a" },
  logo: { width: 110, height: 62, alignSelf: "center", marginBottom: 14, objectFit: "contain" },
  title: { fontSize: 18, fontFamily: "Helvetica-Bold", textAlign: "center", marginBottom: 4 },
  subtitle: { fontSize: 10, textAlign: "center", color: "#666666", marginBottom: 20 },
  summaryRow: { flexDirection: "row", justifyContent: "center", marginBottom: 24 },
  summaryItem: { alignItems: "center", marginHorizontal: 20 },
  summaryLabel: { fontSize: 7, color: "#666666", textTransform: "uppercase", letterSpacing: 1 },
  summaryValue: { fontSize: 15, fontFamily: "Helvetica-Bold", marginTop: 3 },
  tableHeaderRow: { flexDirection: "row", borderBottomWidth: 1, borderBottomColor: "#cccccc", paddingBottom: 6, marginBottom: 4 },
  tableRow: { flexDirection: "row", paddingVertical: 6, borderBottomWidth: 1, borderBottomColor: "#eeeeee" },
  colBookedBy: { width: "26%" },
  colListing: { width: "26%" },
  colDates: { width: "28%" },
  colCredits: { width: "20%", textAlign: "right" },
  headerCell: { fontSize: 7, fontFamily: "Helvetica-Bold", textTransform: "uppercase", color: "#666666", letterSpacing: 0.5 },
  bookedByEmail: { fontSize: 7, color: "#999999", marginTop: 1 },
  durationSubline: { fontSize: 7, color: "#999999", marginTop: 1 },
  emptyState: { padding: 16, textAlign: "center", color: "#999999" },
  footer: {
    position: "absolute",
    bottom: 24,
    left: 40,
    right: 40,
    fontSize: 7,
    color: "#999999",
    textAlign: "center",
    borderTopWidth: 1,
    borderTopColor: "#eeeeee",
    paddingTop: 8,
  },
});

function formatDate(date: Date): string {
  return date.toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" });
}

function dateRangeLabel(from: Date | null, to: Date | null): string {
  if (from && to) return `${formatDate(from)} – ${formatDate(to)}`;
  if (from) return `From ${formatDate(from)}`;
  if (to) return `Through ${formatDate(to)}`;
  return "All time";
}

// Same-day bookings collapse to a single date instead of "Jul 1 – Jul 1".
function bookingDatesLabel(startDate: Date, endDate: Date): string {
  if (startDate.getTime() === endDate.getTime()) return formatDate(startDate);
  return `${formatDate(startDate)} – ${formatDate(endDate)}`;
}

interface BookingActivityReportDocumentProps {
  report: BookingActivityReport;
  logoDataUri: string;
  generatedAt: Date;
  generatedBy: string;
}

export default function BookingActivityReportDocument({
  report,
  logoDataUri,
  generatedAt,
  generatedBy,
}: BookingActivityReportDocumentProps) {
  return (
    <Document>
      <Page size="A4" style={styles.page}>
        <Image src={logoDataUri} style={styles.logo} />
        <Text style={styles.title}>Booking Report</Text>
        <Text style={styles.subtitle}>{dateRangeLabel(report.from, report.to)}</Text>

        <View style={styles.summaryRow}>
          <View style={styles.summaryItem}>
            <Text style={styles.summaryLabel}>Total Bookings</Text>
            <Text style={styles.summaryValue}>{report.totalBookings}</Text>
          </View>
          <View style={styles.summaryItem}>
            <Text style={styles.summaryLabel}>Total Credits</Text>
            <Text style={styles.summaryValue}>{report.totalCredits.toFixed(2)}</Text>
          </View>
        </View>

        <View style={styles.tableHeaderRow} fixed>
          <Text style={[styles.headerCell, styles.colBookedBy]}>Booked By</Text>
          <Text style={[styles.headerCell, styles.colListing]}>What Was Booked</Text>
          <Text style={[styles.headerCell, styles.colDates]}>Booking Dates</Text>
          <Text style={[styles.headerCell, styles.colCredits]}>Credits</Text>
        </View>

        {report.lines.map((line) => (
          <View style={styles.tableRow} key={line.id} wrap={false}>
            <View style={styles.colBookedBy}>
              <Text>{line.bookedByName}</Text>
              <Text style={styles.bookedByEmail}>{line.bookedByEmail}</Text>
            </View>
            <Text style={styles.colListing}>{line.listingName}</Text>
            <View style={styles.colDates}>
              <Text>{bookingDatesLabel(line.startDate, line.endDate)}</Text>
              <Text style={styles.durationSubline}>
                {line.durationDays} day{line.durationDays === 1 ? "" : "s"} · {line.bookingType}
              </Text>
            </View>
            <Text style={styles.colCredits}>{line.credits.toFixed(2)}</Text>
          </View>
        ))}

        {report.lines.length === 0 && <Text style={styles.emptyState}>No bookings in this date range.</Text>}

        <Text
          style={styles.footer}
          fixed
          render={({ pageNumber, totalPages }) =>
            `Generated ${generatedAt.toLocaleString("en-US", { dateStyle: "medium", timeStyle: "short" })} by ${generatedBy}   ·   Page ${pageNumber} of ${totalPages}`
          }
        />
      </Page>
    </Document>
  );
}
