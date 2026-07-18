export type CertificateSource = "platform" | "supplier_created";
export type CertificateStatus = "pending" | "approved" | "rejected";
export type VerificationMethod = "platform" | "external" | "combined";

export interface Certificate {
  id: number;
  name: string;
  icon: string;
  category: string;
  source: CertificateSource;
  status: CertificateStatus;
  verification_method: VerificationMethod;
  verified_by: string | null;
  required_for: string;
  earning_method: string;
}

export interface UserCertificate {
  user_id: number;
  certificate_id: number;
  earned_date: string;
  expiry_date: string | null;
}

export interface TrainingVideo {
  id: number;
  title: string;
  category: string;
  description: string;
  duration_seconds: number;
  video_url: string;
  thumbnail_url: string;
  company_id: number | null;
}

export interface VideoCompletion {
  user_id: number;
  training_video_id: number;
  completed_at: string;
}

export interface CurrentUser {
  id: number;
  name: string;
  role: string;
  location: string;
  email: string;
  company: string;
  member_since: string;
  verified: boolean;
  avatar_url: string | null;
}

export const MOCK_CURRENT_USER: CurrentUser = {
  id: 1,
  name: "Alex Rivera",
  role: "Senior Research Scientist",
  location: "San Francisco, CA",
  email: "alex.rivera@example.com",
  company: "BioNova Labs",
  member_since: "Jul 15, 2026",
  verified: true,
  avatar_url: null,
};

export const MOCK_CERTIFICATES: Certificate[] = [
  {
    id: 1,
    name: "BSL-2 Safety Certification",
    icon: "🧪",
    category: "Safety",
    source: "platform",
    status: "approved",
    verification_method: "platform",
    verified_by: null,
    required_for: "BSL-2 Labs",
    earning_method: "Proctored practical exam",
  },
  {
    id: 2,
    name: "Equipment Handling Certification",
    icon: "⚙️",
    category: "Equipment",
    source: "platform",
    status: "approved",
    verification_method: "platform",
    verified_by: null,
    required_for: "Equipment Rentals",
    earning_method: "Online course + quiz",
  },
  {
    id: 3,
    name: "Molecular Biology Certification",
    icon: "🧬",
    category: "Techniques",
    source: "supplier_created",
    status: "approved",
    verification_method: "combined",
    verified_by: "Stanford BioSafety Institute",
    required_for: "Molecular Biology Labs",
    earning_method: "External lab certification + practical review",
  },
  {
    id: 4,
    name: "Chemical Handling Certification",
    icon: "☣️",
    category: "Safety",
    source: "platform",
    status: "approved",
    verification_method: "platform",
    verified_by: null,
    required_for: "Wet Lab Spaces",
    earning_method: "Online course + quiz",
  },
  {
    id: 5,
    name: "Cryogenics Safety Certification",
    icon: "❄️",
    category: "Equipment",
    source: "supplier_created",
    status: "approved",
    verification_method: "external",
    verified_by: "Seattle Cold Chain Co.",
    required_for: "Cold Storage Equipment",
    earning_method: "Onsite practicum",
  },
  {
    id: 6,
    name: "Radiation Safety Certification",
    icon: "☢️",
    category: "Safety",
    source: "platform",
    status: "approved",
    verification_method: "platform",
    verified_by: null,
    required_for: "Imaging Equipment",
    earning_method: "Proctored practical exam",
  },
];

export const MOCK_USER_CERTIFICATES: UserCertificate[] = [
  {
    user_id: 1,
    certificate_id: 1,
    earned_date: "2026-02-18",
    expiry_date: "2027-02-18",
  },
  {
    user_id: 1,
    certificate_id: 2,
    earned_date: "2026-04-02",
    expiry_date: "2027-04-02",
  },
  {
    user_id: 1,
    certificate_id: 3,
    earned_date: "2026-05-27",
    expiry_date: "2028-05-27",
  },
];

export const MOCK_TRAINING_VIDEOS: TrainingVideo[] = [
  {
    id: 1,
    title: "BSL-2 Lab Safety Basics",
    category: "Safety",
    description: "Core safety procedures required before accessing BSL-2 labs.",
    duration_seconds: 504,
    video_url: "/videos/bsl2-lab-safety-basics.mp4",
    thumbnail_url: "/thumbnails/bsl2-lab-safety-basics.jpg",
    company_id: null,
  },
  {
    id: 2,
    title: "Operating the Centrifuge",
    category: "Equipment",
    description: "Step-by-step walkthrough of safe centrifuge operation.",
    duration_seconds: 310,
    video_url: "/videos/operating-the-centrifuge.mp4",
    thumbnail_url: "/thumbnails/operating-the-centrifuge.jpg",
    company_id: null,
  },
  {
    id: 3,
    title: "Space Access & House Rules",
    category: "House Rules",
    description: "Building access, shared space etiquette, and house rules.",
    duration_seconds: 227,
    video_url: "/videos/space-access-house-rules.mp4",
    thumbnail_url: "/thumbnails/space-access-house-rules.jpg",
    company_id: null,
  },
  {
    id: 4,
    title: "PCR Technique Walkthrough",
    category: "Techniques",
    description: "Detailed PCR setup and technique for accurate results.",
    duration_seconds: 722,
    video_url: "/videos/pcr-technique-walkthrough.mp4",
    thumbnail_url: "/thumbnails/pcr-technique-walkthrough.jpg",
    company_id: 12,
  },
];

export const MOCK_VIDEO_COMPLETIONS: VideoCompletion[] = [
  {
    user_id: 1,
    training_video_id: 1,
    completed_at: "2026-02-15",
  },
  {
    user_id: 1,
    training_video_id: 2,
    completed_at: "2026-03-30",
  },
];

export type EnrollmentSessionStatus = "enrolled" | "awaiting" | "open" | "full";

export interface EnrollmentSession {
  id: number;
  title: string;
  category: string;
  expert_name: string;
  expert_initials: string;
  host_company: string;
  date: string;
  location: string;
  spots_remaining: number;
  endorsement: string;
  required_for: string;
  status: EnrollmentSessionStatus;
}

export const MOCK_ENROLLMENT_SESSIONS: EnrollmentSession[] = [
  {
    id: 1,
    title: "Mass Spectrometry Fundamentals",
    category: "Equipment",
    expert_name: "Dr. Elena Vance",
    expert_initials: "EV",
    host_company: "Boston BioLabs",
    date: "Aug 3, 2026, 10:00 AM",
    location: "Boston, MA",
    spots_remaining: 4,
    endorsement: "Mass Spec Operator Endorsement",
    required_for: "Mass Spectrometry Equipment",
    status: "enrolled",
  },
  {
    id: 2,
    title: "BSL-2 Biosafety Practicum",
    category: "Safety",
    expert_name: "Dr. Raj Patel",
    expert_initials: "RP",
    host_company: "SafetyFirst Labs",
    date: "Aug 10, 2026, 2:00 PM",
    location: "San Francisco, CA",
    spots_remaining: 2,
    endorsement: "Biosafety Practicum Endorsement",
    required_for: "BSL-2 Labs",
    status: "awaiting",
  },
  {
    id: 3,
    title: "Cryogenic Storage Handling",
    category: "Equipment",
    expert_name: "Maria Lopez",
    expert_initials: "ML",
    host_company: "Seattle Cold Chain Co.",
    date: "Aug 18, 2026, 9:00 AM",
    location: "Seattle, WA",
    spots_remaining: 10,
    endorsement: "Cryogenics Handling Endorsement",
    required_for: "Cold Storage Equipment",
    status: "open",
  },
  {
    id: 4,
    title: "Advanced PCR Techniques Workshop",
    category: "Techniques",
    expert_name: "Dr. Sam Okoye",
    expert_initials: "SO",
    host_company: "Austin Genomics Hub",
    date: "Sep 2, 2026, 1:00 PM",
    location: "Austin, TX",
    spots_remaining: 0,
    endorsement: "PCR Techniques Endorsement",
    required_for: "PCR Equipment",
    status: "full",
  },
];

export interface PassportQuizQuestion {
  id: number;
  question: string;
  options: string[];
}

export const MOCK_PASSPORT_QUIZ_QUESTIONS: PassportQuizQuestion[] = [
  {
    id: 1,
    question: "What is the primary purpose of this training module?",
    options: [
      "To review safety procedures",
      "To learn equipment specs",
      "To complete a checklist",
      "To earn credits",
    ],
  },
  {
    id: 2,
    question: "Which step should always be completed first?",
    options: ["Review documentation", "Contact your supervisor", "Put on required PPE", "Start the equipment"],
  },
  {
    id: 3,
    question: "What should you do if you're unsure about a procedure?",
    options: ["Proceed carefully", "Ask a supervisor or SME", "Skip the step", "Guess based on experience"],
  },
  {
    id: 4,
    question: "How often should this training be renewed?",
    options: ["Every 6 months", "Annually", "Every 2 years", "Never"],
  },
];
