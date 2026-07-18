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
}

export const MOCK_CURRENT_USER: CurrentUser = {
  id: 1,
  name: "Alex Rivera",
  role: "Senior Research Scientist",
  location: "San Francisco, CA",
  email: "alex.rivera@example.com",
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
