export interface QuizAnswer {
  text: string;
  is_correct: boolean;
}

export interface QuizQuestion {
  id: string;
  question: string;
  position: number;
  answers: QuizAnswer[];
}

export function makeBlankQuizQuestion(position: number): QuizQuestion {
  return {
    id: `q-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
    question: "",
    position,
    answers: [
      { text: "", is_correct: false },
      { text: "", is_correct: false },
      { text: "", is_correct: false },
      { text: "", is_correct: false },
    ],
  };
}

export type VideoCategory = "Safety" | "Equipment" | "House Rules" | "Techniques";

export const VIDEO_CATEGORIES: VideoCategory[] = ["Safety", "Equipment", "House Rules", "Techniques"];

export interface TutorialVideo {
  id: number;
  title: string;
  category: VideoCategory;
  duration: string;
  completions: number;
  quiz?: QuizQuestion[];
}

export const MOCK_TUTORIAL_VIDEOS: TutorialVideo[] = [
  { id: 1, title: "BSL-2 Lab Safety Basics", category: "Safety", duration: "8:24", completions: 142 },
  { id: 2, title: "Operating the Centrifuge", category: "Equipment", duration: "5:10", completions: 98 },
  { id: 3, title: "Space Access & House Rules", category: "House Rules", duration: "3:47", completions: 210 },
  { id: 4, title: "PCR Technique Walkthrough", category: "Techniques", duration: "12:02", completions: 76 },
  { id: 5, title: "Fire Safety & Emergency Exits", category: "Safety", duration: "6:15", completions: 154 },
  { id: 6, title: "Autoclave Operation Guide", category: "Equipment", duration: "7:30", completions: 63 },
];

export type SessionStatus = "open" | "full" | "completed" | "cancelled";
export type ParticipantStatus = "pass" | "fail" | "pending";

export interface EnrolledParticipant {
  name: string;
  status: ParticipantStatus;
}

export interface TrainingSession {
  id: number;
  certificate: string;
  listing: string;
  date: string;
  location: string;
  enrolled: number;
  capacity: number;
  status: SessionStatus;
  smeSignedOff: boolean;
  enrolledUsers: EnrolledParticipant[];
}

export const MOCK_TRAINING_SESSIONS: TrainingSession[] = [
  {
    id: 1,
    certificate: "BSL-2 Safety Cert",
    listing: "Wet Lab Bench - Downtown SF",
    date: "Jul 22, 2026 · 10:00 AM",
    location: "Building A, Room 204",
    enrolled: 7,
    capacity: 10,
    status: "open",
    smeSignedOff: false,
    enrolledUsers: [
      { name: "Jordan Lee", status: "pass" },
      { name: "Priya Nair", status: "pass" },
      { name: "Marcus Webb", status: "pending" },
      { name: "Sofia Ramirez", status: "pending" },
      { name: "Tom Baker", status: "pass" },
      { name: "Alex Rivera", status: "pending" },
      { name: "Dana Kim", status: "fail" },
    ],
  },
  {
    id: 2,
    certificate: "Equipment Handling Cert",
    listing: "High-Speed Centrifuge",
    date: "Jul 18, 2026 · 2:00 PM",
    location: "Austin Facility, Bay 3",
    enrolled: 10,
    capacity: 10,
    status: "full",
    smeSignedOff: true,
    enrolledUsers: [
      { name: "Casey Nguyen", status: "pass" },
      { name: "Liam O'Connor", status: "pass" },
      { name: "Emma Torres", status: "pass" },
      { name: "Noah Patel", status: "fail" },
    ],
  },
  {
    id: 3,
    certificate: "Chemical Handling Cert",
    listing: "BSL-2 Research Suite",
    date: "Jun 30, 2026 · 9:00 AM",
    location: "Cambridge Suite 2",
    enrolled: 9,
    capacity: 9,
    status: "completed",
    smeSignedOff: true,
    enrolledUsers: [
      { name: "Ravi Shah", status: "pass" },
      { name: "Grace Kim", status: "pass" },
      { name: "Ben Foster", status: "pass" },
    ],
  },
  {
    id: 4,
    certificate: "Radiation Safety Cert",
    listing: "Imaging Equipment",
    date: "Aug 5, 2026 · 1:00 PM",
    location: "Seattle Lab, Room 5",
    enrolled: 3,
    capacity: 10,
    status: "open",
    smeSignedOff: false,
    enrolledUsers: [
      { name: "Mia Chen", status: "pending" },
      { name: "Owen Clark", status: "pending" },
      { name: "Zoe Alvarez", status: "pending" },
    ],
  },
  {
    id: 5,
    certificate: "Molecular Biology Cert",
    listing: "PCR Thermocycler",
    date: "Jul 10, 2026 · 11:00 AM",
    location: "Seattle, WA",
    enrolled: 0,
    capacity: 8,
    status: "cancelled",
    smeSignedOff: false,
    enrolledUsers: [],
  },
];

export const SESSION_LISTING_OPTIONS: string[] = [
  "Wet Lab Bench - Downtown SF",
  "High-Speed Centrifuge",
  "BSL-2 Research Suite",
  "PCR Thermocycler",
  "Imaging Equipment",
];

export const SESSION_CERTIFICATE_OPTIONS: string[] = [
  "BSL-2 Safety Cert",
  "Equipment Handling Cert",
  "Molecular Biology Cert",
  "Chemical Handling Cert",
  "Radiation Safety Cert",
];
