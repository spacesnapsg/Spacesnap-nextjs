import type { QuizQuestion, VideoCategory } from "./mockTutorials";

export type CertCategory = "Safety" | "Equipment" | "House Rules";
export const CERT_CATEGORIES: CertCategory[] = ["Safety", "Equipment", "House Rules"];

export type CertStatus = "pending" | "approved" | "rejected";

export interface AdminCertificate {
  id: number;
  name: string;
  category: CertCategory;
  submittedBy: string;
  description: string;
  status: CertStatus;
  submittedDate: string;
}

// TODO: replace with GET /admin/certificates (all statuses) + /admin/certificates/pending
// once the backend admin panel exists — pending items currently seed alongside the rest.
export const MOCK_ADMIN_CERTIFICATES: AdminCertificate[] = [
  {
    id: 1,
    name: "Biosafety Level 3 Certification",
    category: "Safety",
    submittedBy: "Dana Kim · dana.kim@cellworks.bio",
    description:
      "Required for access to the BSL-3 suite. Covers containment procedures, PPE donning/doffing, and emergency decontamination.",
    status: "pending",
    submittedDate: "2026-07-14",
  },
  {
    id: 2,
    name: "Cryogenic Storage Handling",
    category: "Equipment",
    submittedBy: "Sofia Ramirez · sofia.ramirez@gene-labs.com",
    description: "Required for suppliers listing liquid nitrogen freezers. Covers cold-burn first aid and tank handling.",
    status: "pending",
    submittedDate: "2026-07-11",
  },
  {
    id: 3,
    name: "Biosafety Level 2 Certification",
    category: "Safety",
    submittedBy: "Priya Nair · priya.nair@novabio.io",
    description:
      "Required for handling BSL-2 organisms in the shared lab space. Covers containment, decontamination, and emergency procedures.",
    status: "approved",
    submittedDate: "2025-11-02",
  },
  {
    id: 4,
    name: "Autoclave Operation Training",
    category: "Equipment",
    submittedBy: "Added by Admin",
    description: "Required for suppliers listing autoclave equipment. Confirms operator has completed manufacturer safety training.",
    status: "approved",
    submittedDate: "2025-10-18",
  },
  {
    id: 5,
    name: "Chemical Hygiene Plan Acknowledgement",
    category: "House Rules",
    submittedBy: "Tom Baker · tom.baker@genelabs.com",
    description: "Confirms the supplier has reviewed and agreed to the facility chemical hygiene plan before booking fume hood space.",
    status: "rejected",
    submittedDate: "2025-09-27",
  },
  {
    id: 6,
    name: "Fire Extinguisher Use Certification",
    category: "House Rules",
    submittedBy: "Added by Admin",
    description: "General house-rules requirement for all suppliers accessing shared lab floors.",
    status: "approved",
    submittedDate: "2025-08-14",
  },
  {
    id: 7,
    name: "Radiation Safety Training",
    category: "Safety",
    submittedBy: "Dana Kim · dana.kim@cellworks.bio",
    description: "Required for access to equipment involving radioactive isotopes. Submitted certificate did not include an expiration date.",
    status: "rejected",
    submittedDate: "2025-07-30",
  },
  {
    id: 8,
    name: "Liquid Nitrogen Handling Certification",
    category: "Equipment",
    submittedBy: "Sofia Ramirez · sofia.ramirez@gene-labs.com",
    description: "Required for cryostorage equipment access. Covers PPE requirements and cold-burn first aid.",
    status: "approved",
    submittedDate: "2025-06-05",
  },
];

export interface AdminTrainingVideo {
  id: number;
  title: string;
  category: VideoCategory;
  description: string;
  duration: string;
  thumbnailUrl: string;
  videoUrl: string;
  quiz?: QuizQuestion[];
}

// TODO: replace with GET /admin/training-videos once the backend admin panel exists.
export const MOCK_ADMIN_TRAINING_VIDEOS: AdminTrainingVideo[] = [
  {
    id: 1,
    title: "Platform-Wide Fire Safety & Emergency Exits",
    category: "Safety",
    description: "Baseline evacuation procedures required for every facility on the platform.",
    duration: "6:15",
    thumbnailUrl: "",
    videoUrl: "",
  },
  {
    id: 2,
    title: "Shared Lab Access & House Rules",
    category: "House Rules",
    description: "Covers badge-in procedures, quiet hours, and shared-equipment courtesy expectations.",
    duration: "3:47",
    thumbnailUrl: "",
    videoUrl: "",
  },
  {
    id: 3,
    title: "Autoclave Operation Guide",
    category: "Equipment",
    description: "Manufacturer-endorsed walkthrough for autoclave loading, cycle selection, and unloading.",
    duration: "7:30",
    thumbnailUrl: "",
    videoUrl: "",
  },
  {
    id: 4,
    title: "PCR Technique Walkthrough",
    category: "Techniques",
    description: "Standard operating procedure for PCR setup shared across all supplier facilities.",
    duration: "12:02",
    thumbnailUrl: "",
    videoUrl: "",
  },
];
