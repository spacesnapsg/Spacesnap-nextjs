import "dotenv/config";
import bcrypt from "bcryptjs";
import { PrismaPg } from "@prisma/adapter-pg";
import {
  PrismaClient,
  BookingStatus,
  BookingType,
  CertificateEarningMethod,
  CertificateSource,
  CertificateStatus,
  ListingType,
  TransactionType,
  RewardCatalogueCategory,
  RewardDiscountAppliesTo,
  SupplierRewardCategory,
  SupplierReportTargetGroup,
} from "../app/generated/prisma/client";

const adapter = new PrismaPg({ connectionString: process.env.DATABASE_URL });
const prisma = new PrismaClient({ adapter });

const password = (plain: string) => bcrypt.hashSync(plain, 10);

async function reset() {
  // Children first, in FK order, so this is safe to re-run.
  await prisma.rewardCatalogueItem.deleteMany();
  await prisma.supplierRewardCatalogueItem.deleteMany();
  await prisma.quizAnswer.deleteMany();
  await prisma.quizQuestion.deleteMany();
  await prisma.videoCompletion.deleteMany();
  await prisma.trainingVideo.deleteMany();
  await prisma.trainingSession.deleteMany();
  await prisma.transaction.deleteMany();
  await prisma.booking.deleteMany();
  await prisma.listingRequiredCertificate.deleteMany();
  await prisma.userCertificate.deleteMany();
  await prisma.listing.deleteMany();
  await prisma.certificate.deleteMany();
  await prisma.session.deleteMany();
  await prisma.account.deleteMany();
  await prisma.verificationToken.deleteMany();
  await prisma.user.deleteMany();
  await prisma.company.deleteMany();
}

async function main() {
  await reset();

  // --- Companies -----------------------------------------------------
  const acme = await prisma.company.create({
    data: {
      name: "Acme Coworking Pte Ltd",
      businessName: "Acme Coworking",
      businessDescription: "Flexible desks and meeting rooms across the CBD.",
      contactEmail: "hello@acmecoworking.sg",
      businessLocation: "Raffles Place, Singapore",
      yearsOperating: 6,
    },
  });

  const toolshare = await prisma.company.create({
    data: {
      name: "ToolShare SG",
      businessName: "ToolShare SG",
      businessDescription: "Heavy equipment rental for short-term projects.",
      contactEmail: "ops@toolshare.sg",
      businessLocation: "Tuas, Singapore",
      yearsOperating: 3,
    },
  });

  const greenpack = await prisma.company.create({
    data: {
      name: "GreenPack Supplies",
      businessName: "GreenPack Supplies",
      businessDescription: "Sustainable packaging consumables, sold in bulk.",
      contactEmail: "sales@greenpack.sg",
      businessLocation: "Jurong, Singapore",
      yearsOperating: 2,
    },
  });

  // --- Users (one of each role) ---------------------------------------
  const admin = await prisma.user.create({
    data: {
      name: "Alice Tan",
      email: "alice.admin@spacesnap.sg",
      password: password("password123"),
      title: "System Administrator",
      isSystemAdmin: true,
    },
  });

  const acmeAdmin = await prisma.user.create({
    data: {
      name: "Ben Ong",
      email: "ben@acmecoworking.sg",
      password: password("password123"),
      title: "Operations Lead",
      isSupplier: true,
      isCompanyAdmin: true,
      companyId: acme.id,
      stripeConnectAccountId: "acct_test_acme001",
    },
  });

  const acmeSupplier = await prisma.user.create({
    data: {
      name: "Chandra Lim",
      email: "chandra@acmecoworking.sg",
      password: password("password123"),
      title: "Front Desk Supplier",
      isSupplier: true,
      companyId: acme.id,
    },
  });

  const toolshareAdmin = await prisma.user.create({
    data: {
      name: "Divya Nair",
      email: "divya@toolshare.sg",
      password: password("password123"),
      title: "Fleet Manager",
      isSupplier: true,
      isCompanyAdmin: true,
      companyId: toolshare.id,
      stripeConnectAccountId: "acct_test_toolshare001",
    },
  });

  const greenpackAdmin = await prisma.user.create({
    data: {
      name: "Gabriel Wong",
      email: "gabriel@greenpack.sg",
      password: password("password123"),
      title: "Warehouse Lead",
      isSupplier: true,
      isCompanyAdmin: true,
      companyId: greenpack.id,
    },
  });

  const ethan = await prisma.user.create({
    data: {
      name: "Ethan Goh",
      email: "ethan@example.com",
      password: password("password123"),
      title: "Freelance Designer",
      stripeCustomerId: "cus_test_ethan001",
    },
  });

  const farah = await prisma.user.create({
    data: {
      name: "Farah Ismail",
      email: "farah@example.com",
      password: password("password123"),
      title: "Site Engineer",
      stripeCustomerId: "cus_test_farah001",
    },
  });

  const suspendedUser = await prisma.user.create({
    data: {
      name: "Wei Liang Koh",
      email: "weiliang@example.com",
      password: password("password123"),
      status: "suspended",
    },
  });

  // --- Certificates (every source/status combination) -----------------
  const safetyInduction = await prisma.certificate.create({
    data: {
      name: "Basic Safety Induction",
      icon: "shield-check",
      category: "safety",
      earningMethod: CertificateEarningMethod.tier1_video_quiz,
      source: CertificateSource.platform,
      status: CertificateStatus.approved,
    },
  });

  const forkliftCert = await prisma.certificate.create({
    data: {
      name: "Equipment Handling - Forklift",
      icon: "forklift",
      category: "equipment",
      earningMethod: CertificateEarningMethod.tier2a_operator_signoff,
      source: CertificateSource.platform,
      status: CertificateStatus.approved,
    },
  });

  const fireMarshalCert = await prisma.certificate.create({
    data: {
      name: "Fire Safety Marshal",
      icon: "flame",
      category: "safety",
      earningMethod: CertificateEarningMethod.tier2b_operator_or_sme_signoff,
      submissionNotes: "SCDF-endorsed marshal programme run at our Raffles Place site.",
      source: CertificateSource.supplier_created,
      status: CertificateStatus.approved,
      createdByCompanyId: acme.id,
      reviewedBy: admin.id,
      reviewedAt: new Date("2026-06-02T09:00:00+08:00"),
    },
  });

  const chemicalHandlingCert = await prisma.certificate.create({
    data: {
      name: "Chemical Handling Cert",
      icon: "flask-conical",
      category: "safety",
      earningMethod: CertificateEarningMethod.tier2a_operator_signoff,
      submissionNotes: "Covers safe storage/disposal for our packaging solvents.",
      source: CertificateSource.supplier_created,
      status: CertificateStatus.pending,
      createdByCompanyId: greenpack.id,
    },
  });

  const machineOpCert = await prisma.certificate.create({
    data: {
      name: "Custom Machine Op License",
      icon: "cog",
      category: "equipment",
      earningMethod: CertificateEarningMethod.tier2a_operator_signoff,
      submissionNotes: "In-house license for our proprietary packing machine.",
      source: CertificateSource.supplier_created,
      status: CertificateStatus.rejected,
      createdByCompanyId: toolshare.id,
      reviewedBy: admin.id,
      reviewedAt: new Date("2026-06-10T14:30:00+08:00"),
    },
  });

  // --- Listings (one per type, plus a gated one) -----------------------
  const studioSpace = await prisma.listing.create({
    data: {
      companyId: acme.id,
      type: ListingType.space,
      name: "Studio Space A",
      location: "Raffles Place, Level 12",
      description: "Bright open studio, seats up to 15, whiteboard + projector.",
      imageUrl: "https://images.spacesnap.sg/listings/studio-space-a.jpg",
      amenities: ["wifi", "projector", "whiteboard", "aircon"],
      isAvailable: true,
      requireApproval: false,
      priceDay: "120.00",
      priceWeek: "650.00",
      priceMonth: "2200.00",
    },
  });

  const meetingRoom = await prisma.listing.create({
    data: {
      companyId: acme.id,
      type: ListingType.space,
      name: "Meeting Room B",
      location: "Raffles Place, Level 12",
      description: "Enclosed meeting room, seats 6. Requires fire marshal cert on-site.",
      imageUrl: "https://images.spacesnap.sg/listings/meeting-room-b.jpg",
      amenities: ["wifi", "tv-screen"],
      isAvailable: true,
      requireApproval: true,
      priceDay: "60.00",
      priceWeek: "320.00",
      priceMonth: "1100.00",
    },
  });

  const forkliftListing = await prisma.listing.create({
    data: {
      companyId: toolshare.id,
      type: ListingType.equipment,
      name: "Forklift Rental",
      location: "Tuas Yard 4",
      description: "2.5-tonne forklift, diesel, includes basic maintenance kit.",
      imageUrl: "https://images.spacesnap.sg/listings/forklift.jpg",
      amenities: ["maintenance-kit", "operator-manual"],
      isAvailable: true,
      requireApproval: true,
      priceDay: "180.00",
      priceWeek: "950.00",
      priceMonth: "3200.00",
    },
  });

  const drillSetListing = await prisma.listing.create({
    data: {
      companyId: toolshare.id,
      type: ListingType.equipment,
      name: "Power Drill Set",
      location: "Tuas Yard 4",
      description: "Cordless drill set with two batteries and a bit case.",
      amenities: ["carry-case"],
      isAvailable: true,
      requireApproval: false,
      priceDay: "25.00",
      priceWeek: "120.00",
      priceMonth: "400.00",
    },
  });

  const packagingListing = await prisma.listing.create({
    data: {
      companyId: greenpack.id,
      type: ListingType.consumables,
      name: "Compostable Packaging Boxes (Pack of 50)",
      location: "Jurong Warehouse",
      description: "Compostable corrugate boxes, medium size, sold by the pack.",
      amenities: [],
      isAvailable: true,
      requireApproval: false,
      pricePerUnit: "18.50",
      stockQuantity: 400,
      packSize: "Pack of 50",
    },
  });

  // --- listing_required_certificates -----------------------------------
  await prisma.listingRequiredCertificate.create({
    data: { listingId: meetingRoom.id, certificateId: fireMarshalCert.id },
  });
  await prisma.listingRequiredCertificate.create({
    data: { listingId: forkliftListing.id, certificateId: forkliftCert.id },
  });

  // --- user_certificates (earned certs, incl. one expired) --------------
  await prisma.userCertificate.create({
    data: {
      userId: ethan.id,
      certificateId: safetyInduction.id,
      earnedDate: new Date("2026-01-15"),
    },
  });
  await prisma.userCertificate.create({
    data: {
      userId: ethan.id,
      certificateId: fireMarshalCert.id,
      earnedDate: new Date("2025-01-10"),
      expiryDate: new Date("2026-01-10"), // already expired relative to 2026-07-19
    },
  });
  await prisma.userCertificate.create({
    data: {
      userId: farah.id,
      certificateId: forkliftCert.id,
      earnedDate: new Date("2026-03-01"),
      expiryDate: new Date("2027-03-01"),
    },
  });
  await prisma.userCertificate.create({
    data: {
      userId: farah.id,
      certificateId: safetyInduction.id,
      earnedDate: new Date("2026-02-20"),
    },
  });

  // --- training_videos (platform + supplier authored) --------------------
  const safetyVideo = await prisma.trainingVideo.create({
    data: {
      companyId: null,
      // tier1_video_quiz earning path (Sprint 4, Item 4): passing this
      // video's quiz below auto-issues safetyInduction.
      certificateId: safetyInduction.id,
      title: "Workplace Safety 101",
      category: "safety",
      description: "Platform-wide induction covering general workplace safety basics.",
      durationSeconds: 600,
      videoUrl: "https://videos.spacesnap.sg/training/workplace-safety-101.mp4",
      thumbnailUrl: "https://images.spacesnap.sg/training/workplace-safety-101.jpg",
    },
  });

  const forkliftVideo = await prisma.trainingVideo.create({
    data: {
      companyId: toolshare.id,
      title: "Forklift Operation Basics",
      category: "equipment",
      description: "ToolShare's own walkthrough before renting our forklifts.",
      durationSeconds: 900,
      videoUrl: "https://videos.spacesnap.sg/training/forklift-operation-basics.mp4",
      thumbnailUrl: "https://images.spacesnap.sg/training/forklift-operation-basics.jpg",
    },
  });

  await prisma.trainingVideo.create({
    data: {
      companyId: greenpack.id,
      title: "Chemical Storage Guidelines",
      category: "safety",
      description: "How GreenPack expects solvents and adhesives to be stored on-site.",
      durationSeconds: 450,
      videoUrl: "https://videos.spacesnap.sg/training/chemical-storage-guidelines.mp4",
      thumbnailUrl: "https://images.spacesnap.sg/training/chemical-storage-guidelines.jpg",
    },
  });

  // --- video_completions ---------------------------------------------
  await prisma.videoCompletion.create({
    data: { userId: ethan.id, trainingVideoId: safetyVideo.id, completedAt: new Date("2026-01-14") },
  });
  await prisma.videoCompletion.create({
    data: { userId: farah.id, trainingVideoId: safetyVideo.id, completedAt: new Date("2026-02-19") },
  });
  await prisma.videoCompletion.create({
    data: { userId: farah.id, trainingVideoId: forkliftVideo.id, completedAt: new Date("2026-02-28") },
  });

  // --- quiz_questions / quiz_answers -----------------------------------
  const safetyQuizQuestions: Array<{ question: string; answers: [string, boolean][] }> = [
    {
      question: "What should you do first when you spot a workplace hazard?",
      answers: [
        ["Report it to a supervisor or marshal", true],
        ["Ignore it if it's not urgent", false],
        ["Post about it on social media", false],
        ["Wait for someone else to notice", false],
      ],
    },
    {
      question: "Where should the nearest fire extinguisher be located relative to your desk?",
      answers: [
        ["Clearly marked and within quick reach", true],
        ["It doesn't matter", false],
        ["Locked in a supply room", false],
        ["Only in the basement", false],
      ],
    },
    {
      question: "When is it acceptable to prop open a fire door?",
      answers: [
        ["Never, unless it has an approved hold-open device", true],
        ["Whenever it's hot", false],
        ["During lunch hours", false],
        ["If you're expecting visitors", false],
      ],
    },
    {
      question: "Who is responsible for workplace safety?",
      answers: [
        ["Everyone on site", true],
        ["Only the system admin", false],
        ["Only suppliers", false],
        ["Only the cleaning crew", false],
      ],
    },
  ];

  for (const [index, q] of safetyQuizQuestions.entries()) {
    const question = await prisma.quizQuestion.create({
      data: { trainingVideoId: safetyVideo.id, question: q.question, position: index },
    });
    await prisma.quizAnswer.createMany({
      data: q.answers.map(([text, isCorrect], position) => ({
        quizQuestionId: question.id,
        text,
        isCorrect,
        position,
      })),
    });
  }

  const forkliftQuizQuestions: Array<{ question: string; answers: [string, boolean][] }> = [
    {
      question: "What is the maximum rated load for the rental forklift?",
      answers: [
        ["2.5 tonnes", true],
        ["500 kg", false],
        ["10 tonnes", false],
        ["There is no limit", false],
      ],
    },
    {
      question: "What should you check before starting the forklift?",
      answers: [
        ["Fuel, tyres, and hydraulic fluid levels", true],
        ["Nothing, it's pre-checked by ToolShare every time", false],
        ["Only the horn", false],
        ["The weather forecast", false],
      ],
    },
    {
      question: "How should you carry a raised load while driving?",
      answers: [
        ["Tilted back and as low as safely possible", true],
        ["As high as possible for visibility", false],
        ["Tilted forward", false],
        ["It doesn't matter", false],
      ],
    },
    {
      question: "What do you do if the forklift's hydraulics fail mid-lift?",
      answers: [
        ["Lower the load carefully, power off, and report it", true],
        ["Keep working and report it at the end of the day", false],
        ["Shake the load loose", false],
        ["Abandon the forklift with the load raised", false],
      ],
    },
  ];

  for (const [index, q] of forkliftQuizQuestions.entries()) {
    const question = await prisma.quizQuestion.create({
      data: { trainingVideoId: forkliftVideo.id, question: q.question, position: index },
    });
    await prisma.quizAnswer.createMany({
      data: q.answers.map(([text, isCorrect], position) => ({
        quizQuestionId: question.id,
        text,
        isCorrect,
        position,
      })),
    });
  }

  // --- training_sessions -------------------------------------------------
  await prisma.trainingSession.create({
    data: {
      companyId: acme.id,
      // tier2b_operator_or_sme_signoff earning path (Sprint 4, Item 4): a
      // supplier completing this enrollment's sign-off auto-issues
      // fireMarshalCert. Matches endorsementName below — that field is
      // display text carried over from the old schema and was never wired to
      // real issuance (see CODEBASEAPI_SUMMARY.md §6), so certificateId is
      // the actual link, kept consistent with it here.
      certificateId: fireMarshalCert.id,
      title: "Fire Marshal Certification Workshop",
      smeName: "SCDF Officer Rahman",
      description: "Half-day workshop covering fire marshal duties and evacuation drills.",
      sessionDatetime: new Date("2026-08-05T09:00:00+08:00"),
      location: "Acme Coworking, Raffles Place",
      endorsementName: "Fire Safety Marshal",
      capacity: 20,
    },
  });

  await prisma.trainingSession.create({
    data: {
      companyId: toolshare.id,
      // No certificateId here (unlike the Fire Marshal session above):
      // forkliftCert's earning method is tier2a_operator_signoff, which is
      // NOT a scheduled-session/enrollment flow — confirmed with the product
      // owner (see CLAUDE1.md "Sprint 4, Item 4, Correction"). tier2a is an
      // on-demand per-user request (live demo or uploaded recording),
      // handled by lib/certificate-signoffs.ts instead. This session stays
      // as plain informational/demo content with no auto-issuance wired to
      // it — TrainingSession.certificateId is tier2b-only.
      title: "Forklift Practical Assessment",
      smeName: "Certified Trainer Lim",
      description: "Hands-on practical assessment on the yard forklift fleet.",
      sessionDatetime: new Date("2026-08-12T13:00:00+08:00"),
      location: "ToolShare Yard 4, Tuas",
      endorsementName: "Equipment Handling - Forklift",
      capacity: 8,
    },
  });

  await prisma.trainingSession.create({
    data: {
      companyId: null,
      title: "Platform Onboarding Webinar",
      smeName: "SpaceSnap Team",
      description: "General walkthrough of booking, credits, and the digital passport.",
      sessionDatetime: new Date("2026-07-25T18:00:00+08:00"),
      location: "Online",
      capacity: 100,
    },
  });

  // --- bookings + transactions (ledger pattern) --------------------------
  // 1. Completed booking, paid in full at creation.
  const completedBooking = await prisma.booking.create({
    data: {
      userId: ethan.id,
      listingId: studioSpace.id,
      bookingType: BookingType.daily,
      startDate: new Date("2026-06-10"),
      endDate: new Date("2026-06-10"),
      sgdAmount: "120.00",
      status: BookingStatus.completed,
    },
  });
  await prisma.transaction.create({
    data: {
      userId: ethan.id,
      bookingId: completedBooking.id,
      type: TransactionType.booking,
      amount: "-120.00",
      description: "Booking: Studio Space A (2026-06-10)",
    },
  });

  // 2. Confirmed booking — debit at creation, plus the confirm-time audit
  //    row the old app was missing (Sprint 3.5 gap, schema now supports it).
  const confirmedBooking = await prisma.booking.create({
    data: {
      userId: farah.id,
      listingId: forkliftListing.id,
      bookingType: BookingType.weekly,
      startDate: new Date("2026-08-01"),
      endDate: new Date("2026-08-07"),
      sgdAmount: "950.00",
      status: BookingStatus.confirmed,
    },
  });
  await prisma.transaction.create({
    data: {
      userId: farah.id,
      bookingId: confirmedBooking.id,
      type: TransactionType.booking,
      amount: "-950.00",
      description: "Booking: Forklift Rental (2026-08-01 to 2026-08-07)",
    },
  });
  await prisma.transaction.create({
    data: {
      userId: farah.id,
      bookingId: confirmedBooking.id,
      type: TransactionType.booking,
      amount: "0.00",
      description: "Booking confirmed by supplier (ToolShare SG)",
    },
  });

  // 3. Pending booking — debit at creation, awaiting supplier action.
  const pendingBooking = await prisma.booking.create({
    data: {
      userId: ethan.id,
      listingId: meetingRoom.id,
      bookingType: BookingType.daily,
      startDate: new Date("2026-07-28"),
      endDate: new Date("2026-07-28"),
      sgdAmount: "60.00",
      status: BookingStatus.pending,
    },
  });
  await prisma.transaction.create({
    data: {
      userId: ethan.id,
      bookingId: pendingBooking.id,
      type: TransactionType.booking,
      amount: "-60.00",
      description: "Booking: Meeting Room B (2026-07-28)",
    },
  });

  // 4. Active booking — currently underway.
  const activeBooking = await prisma.booking.create({
    data: {
      userId: ethan.id,
      listingId: studioSpace.id,
      bookingType: BookingType.daily,
      startDate: new Date("2026-07-18"),
      endDate: new Date("2026-07-20"),
      sgdAmount: "240.00",
      status: BookingStatus.active,
    },
  });
  await prisma.transaction.create({
    data: {
      userId: ethan.id,
      bookingId: activeBooking.id,
      type: TransactionType.booking,
      amount: "-240.00",
      description: "Booking: Studio Space A (2026-07-18 to 2026-07-20)",
    },
  });

  // 5. Cancelled booking — debited then refunded on decline.
  const cancelledBooking = await prisma.booking.create({
    data: {
      userId: farah.id,
      listingId: drillSetListing.id,
      bookingType: BookingType.weekly,
      startDate: new Date("2026-06-15"),
      endDate: new Date("2026-06-21"),
      sgdAmount: "120.00",
      status: BookingStatus.cancelled,
    },
  });
  await prisma.transaction.create({
    data: {
      userId: farah.id,
      bookingId: cancelledBooking.id,
      type: TransactionType.booking,
      amount: "-120.00",
      description: "Booking: Power Drill Set (2026-06-15 to 2026-06-21)",
    },
  });
  await prisma.transaction.create({
    data: {
      userId: farah.id,
      bookingId: cancelledBooking.id,
      type: TransactionType.refund,
      amount: "120.00",
      description: "Refund: Power Drill Set booking declined by supplier",
    },
  });

  // --- topups + a standalone purchase (bulk-order style) ------------------
  await prisma.transaction.create({
    data: { userId: ethan.id, type: TransactionType.topup, amount: "500.00", stripePaymentIntentId: "pi_test_ethan001", description: "Wallet top-up" },
  });
  await prisma.transaction.create({
    data: { userId: farah.id, type: TransactionType.topup, amount: "800.00", stripePaymentIntentId: "pi_test_farah001", description: "Wallet top-up" },
  });
  await prisma.transaction.create({
    data: {
      userId: farah.id,
      type: TransactionType.purchase,
      amount: "-370.00",
      description: "Bulk order: Compostable Packaging Boxes x20 packs",
    },
  });

  // --- Rewards catalogue (Sprint 6.6 UI, Sprint 6.7/6.8/6.9 admin CRUD) ----
  // Starter rows only — admin can add/edit/delete freely via /admin-rewards,
  // this is not a fixed list. Placeholder values so there's something to
  // edit rather than blanks.
  await prisma.rewardCatalogueItem.create({
    data: {
      category: RewardCatalogueCategory.discount,
      name: "Discount Voucher",
      description: "Offsets a percentage of your booking fee for spaces and equipment.",
      discountPercent: "10.00",
      discountAppliesTo: [RewardDiscountAppliesTo.booking],
      creditCost: "50.00",
      quantityAvailable: null,
    },
  });
  await prisma.rewardCatalogueItem.create({
    data: {
      category: RewardCatalogueCategory.pitch_ticket,
      name: "VC Pitch Ticket",
      description: "A 1-hour session with a partner VC to pitch your startup.",
      partnerOptions: ["TBD"],
      creditCost: "500.00",
      quantityAvailable: 5,
    },
  });
  await prisma.rewardCatalogueItem.create({
    data: {
      category: RewardCatalogueCategory.consultancy,
      name: "Legal Consultancy",
      description: "A 1-hour session with a partner legal firm.",
      consultancySubject: "Legal",
      partnerOptions: ["TBD"],
      creditCost: "400.00",
      quantityAvailable: 10,
    },
  });
  await prisma.rewardCatalogueItem.create({
    data: {
      category: RewardCatalogueCategory.events,
      name: "Exclusive Event Invite",
      description: "Entry to an event organized by SpaceSnap or its affiliates.",
      eventName: "TBD",
      eventInfo: "TBD",
      creditCost: "200.00",
      quantityAvailable: 20,
    },
  });
  await prisma.rewardCatalogueItem.create({
    data: {
      category: RewardCatalogueCategory.lucky_draw,
      name: "Lucky Draw Ticket",
      description: "A chance in a lucky draw for various prizes (TBC).",
      prizeDescription: "TBD",
      prizeQuantity: 1,
      creditCost: "100.00",
      quantityAvailable: 50,
    },
  });
  await prisma.rewardCatalogueItem.create({
    data: {
      category: RewardCatalogueCategory.tier_upgrade,
      name: "Premium Tier Upgrade",
      description: "Upgrades you to the next membership tier for a limited time.",
      upgradeDurationMonths: 3,
      creditCost: "1000.00",
      quantityAvailable: null,
    },
  });
  await prisma.rewardCatalogueItem.create({
    data: {
      category: RewardCatalogueCategory.consumable,
      name: "Consumable Redemption",
      description: "A consumable redemption at the consumables kiosk.",
      consumableName: "TBD",
      consumableQuantity: 1,
      creditCost: "50.00",
      quantityAvailable: null,
    },
  });

  // --- Supplier rewards catalogue (Sprint 6.10) ----------------------------
  // Starter rows only, same "not a fixed list" convention as the user-facing
  // catalogue above — admin can add/edit/delete freely via the Supplier
  // Catalogue tab on /admin-rewards. Placeholder credit costs, same "use a
  // random number first" posture the product owner gave for the original
  // hardcoded PLACEHOLDER_REWARDS UI these rows replace.
  await prisma.supplierRewardCatalogueItem.create({
    data: {
      category: SupplierRewardCategory.report,
      name: "Targeted Insights Report",
      description: "A statistics report on your chosen target group.",
      reportTargetGroups: [SupplierReportTargetGroup.bookings, SupplierReportTargetGroup.equipment, SupplierReportTargetGroup.consumables],
      creditCost: "800.00",
      quantityAvailable: null,
    },
  });
  await prisma.supplierRewardCatalogueItem.create({
    data: {
      category: SupplierRewardCategory.report,
      name: "Platform Performance Report",
      description: "Platform-wide analytics and performance benchmarks.",
      creditCost: "1200.00",
      quantityAvailable: null,
    },
  });
  await prisma.supplierRewardCatalogueItem.create({
    data: {
      category: SupplierRewardCategory.ad,
      name: "Popup Ad Campaign",
      description: "Run a popup ad campaign for your listings.",
      campaignDurationDays: 7,
      creditCost: "400.00",
      quantityAvailable: 10,
    },
  });
  await prisma.supplierRewardCatalogueItem.create({
    data: {
      category: SupplierRewardCategory.ad,
      name: "Spotlight Listing",
      description: "Ensure your listing appears at the top of search results.",
      campaignDurationDays: 14,
      creditCost: "600.00",
      quantityAvailable: 10,
    },
  });
  await prisma.supplierRewardCatalogueItem.create({
    data: {
      category: SupplierRewardCategory.ad,
      name: "Newsletter Feature",
      description: "Be featured in our newsletter (EDM).",
      campaignDurationDays: 1,
      creditCost: "300.00",
      quantityAvailable: 5,
    },
  });
  await prisma.supplierRewardCatalogueItem.create({
    data: {
      category: SupplierRewardCategory.system,
      name: "Tier Boost",
      description: "Temporarily bump your supplier tier for a set duration.",
      upgradeDurationMonths: 3,
      creditCost: "1000.00",
      quantityAvailable: null,
    },
  });

  console.log("Seed complete:", {
    companies: 3,
    users: 8,
    certificates: 5,
    listings: 5,
    trainingVideos: 3,
    trainingSessions: 3,
    bookings: 5,
    rewardCatalogueItems: 7,
    supplierRewardCatalogueItems: 6,
  });
}

main()
  .catch((error) => {
    console.error(error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
