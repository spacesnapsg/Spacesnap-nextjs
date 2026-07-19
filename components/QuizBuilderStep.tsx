"use client";

// TODO: still on mock data (lib/mockTutorials.ts) — waiting on this stack's port of
// the old QuizQuestionController.
import { useState } from "react";
import { Plus, Trash2 } from "lucide-react";
import Button from "./Button";
import Input from "./Input";
import { makeBlankQuizQuestion, type QuizQuestion } from "@/lib/mockTutorials";

const MIN_QUESTIONS = 15;

interface ValidationResult {
  valid: boolean;
  global: string | null;
  perQuestion: Record<string, string>;
}

function validateQuestions(questions: QuizQuestion[]): ValidationResult {
  const perQuestion: Record<string, string> = {};
  questions.forEach((q) => {
    const filledAnswers = q.answers.filter((a) => a.text.trim()).length;
    const hasCorrect = q.answers.some((a) => a.is_correct);
    if (!q.question.trim()) {
      perQuestion[q.id] = "Enter a question.";
    } else if (filledAnswers < q.answers.length) {
      perQuestion[q.id] = `All ${q.answers.length} answer options are required.`;
    } else if (!hasCorrect) {
      perQuestion[q.id] = "Mark one answer as correct.";
    }
  });

  let global: string | null = null;
  if (questions.length < MIN_QUESTIONS) {
    global = `Add at least ${MIN_QUESTIONS} questions before saving (${questions.length}/${MIN_QUESTIONS} so far).`;
  } else if (Object.keys(perQuestion).length > 0) {
    global = "Fix the highlighted questions before saving.";
  }

  return { valid: !global, global, perQuestion };
}

interface QuizBuilderStepProps {
  questions: QuizQuestion[];
  onChange: (questions: QuizQuestion[]) => void;
  onBack: () => void;
  onSave: (questions: QuizQuestion[]) => void;
  saving?: boolean;
  saveError?: string;
  accentClassName?: string;
  saveButtonClassName?: string;
}

export default function QuizBuilderStep({
  questions,
  onChange,
  onBack,
  onSave,
  saving = false,
  saveError = "",
  accentClassName = "accent-supplier-purple-start",
  saveButtonClassName = "",
}: QuizBuilderStepProps) {
  const [errors, setErrors] = useState<ValidationResult | null>(null);

  function updateQuestion(id: string, patch: Partial<QuizQuestion>) {
    onChange(questions.map((q) => (q.id === id ? { ...q, ...patch } : q)));
  }

  function updateAnswerText(id: string, index: number, text: string) {
    onChange(
      questions.map((q) =>
        q.id === id
          ? { ...q, answers: q.answers.map((a, i) => (i === index ? { ...a, text } : a)) }
          : q
      )
    );
  }

  function setCorrectAnswer(id: string, index: number) {
    onChange(
      questions.map((q) =>
        q.id === id
          ? { ...q, answers: q.answers.map((a, i) => ({ ...a, is_correct: i === index })) }
          : q
      )
    );
  }

  function addQuestion() {
    onChange([...questions, makeBlankQuizQuestion(questions.length + 1)]);
  }

  function removeQuestion(id: string) {
    onChange(
      questions.filter((q) => q.id !== id).map((q, i) => ({ ...q, position: i + 1 }))
    );
  }

  function handleSaveClick() {
    const finalQuestions = questions.map((q, i) => ({ ...q, position: i + 1 }));
    const result = validateQuestions(finalQuestions);
    if (!result.valid) {
      setErrors(result);
      return;
    }
    setErrors(null);
    onSave(finalQuestions);
  }

  const count = questions.length;
  const countMet = count >= MIN_QUESTIONS;

  return (
    <div className="flex flex-col gap-4">
      <div className="flex items-center justify-between gap-4">
        <h2 className="text-xl font-semibold text-body-text">Build the Quiz</h2>
        <span
          className={`shrink-0 rounded-full border px-3 py-1 text-xs font-medium whitespace-nowrap ${
            countMet
              ? "bg-success-green/15 text-success-green border-success-green/30"
              : "bg-amber/15 text-amber border-amber/30"
          }`}
        >
          {count}/{MIN_QUESTIONS} questions minimum
        </span>
      </div>

      {errors?.global && (
        <p className="text-sm text-error-red bg-error-red/10 border border-error-red/30 rounded px-4 py-3">
          {errors.global}
        </p>
      )}
      {saveError && (
        <p className="text-sm text-error-red bg-error-red/10 border border-error-red/30 rounded px-4 py-3">
          {saveError}
        </p>
      )}

      <div className="flex flex-col gap-4 max-h-[420px] overflow-y-auto pr-1">
        {questions.map((q, qIndex) => (
          <div
            key={q.id}
            className={`bg-background border rounded p-4 flex flex-col gap-3 ${
              errors?.perQuestion?.[q.id] ? "border-error-red/50" : "border-border/40"
            }`}
          >
            <div className="flex items-center justify-between gap-2">
              <label className="text-xs text-muted-text">Question {qIndex + 1}</label>
              <button
                type="button"
                onClick={() => removeQuestion(q.id)}
                aria-label="Remove question"
                className="text-muted-text hover:text-error-red transition-colors"
              >
                <Trash2 size={16} />
              </button>
            </div>

            <Input
              value={q.question}
              onChange={(e) => updateQuestion(q.id, { question: e.target.value })}
              placeholder="Enter the question"
              className="w-full"
            />

            <div className="flex flex-col gap-2">
              {q.answers.map((answer, aIndex) => (
                <label key={aIndex} className="flex items-center gap-2">
                  <input
                    type="radio"
                    name={`correct-${q.id}`}
                    checked={answer.is_correct}
                    onChange={() => setCorrectAnswer(q.id, aIndex)}
                    className={`${accentClassName} shrink-0`}
                  />
                  <Input
                    value={answer.text}
                    onChange={(e) => updateAnswerText(q.id, aIndex, e.target.value)}
                    placeholder={`Option ${aIndex + 1}`}
                    className="w-full h-9"
                  />
                </label>
              ))}
            </div>

            {errors?.perQuestion?.[q.id] && (
              <p className="text-xs text-error-red">{errors.perQuestion[q.id]}</p>
            )}
          </div>
        ))}
      </div>

      <Button type="button" variant="ghost" onClick={addQuestion} className="gap-1.5 self-start">
        <Plus size={16} />
        Add Question
      </Button>

      <div className="flex items-center justify-between gap-3 mt-2">
        <Button type="button" variant="ghost" onClick={onBack}>
          Back
        </Button>
        <Button type="button" onClick={handleSaveClick} disabled={saving} className={saveButtonClassName}>
          {saving ? "Saving…" : "Save Quiz"}
        </Button>
      </div>
    </div>
  );
}
