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
