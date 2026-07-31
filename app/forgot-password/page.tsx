"use client";

import { useState, type ChangeEvent, type FormEvent } from "react";
import { useMutation } from "@tanstack/react-query";
import Link from "next/link";
import Card from "@/components/Card";
import Input from "@/components/Input";
import Button from "@/components/Button";

const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

interface ForgotPasswordResponse {
  message: string;
  resetUrl: string | null;
}

export default function ForgotPasswordPage() {
  const [email, setEmail] = useState("");
  const [error, setError] = useState("");
  const [result, setResult] = useState<ForgotPasswordResponse | null>(null);

  const forgotPasswordMutation = useMutation({
    mutationFn: async (email: string): Promise<ForgotPasswordResponse> => {
      const response = await fetch("/api/auth/forgot-password", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email }),
      });
      const data = await response.json().catch(() => null);
      if (!response.ok) {
        throw new Error(data?.message || "Something went wrong. Please try again.");
      }
      return data as ForgotPasswordResponse;
    },
    onSuccess: (data) => setResult(data),
    onError: (err: Error) => setError(err.message),
  });

  function handleChange(e: ChangeEvent<HTMLInputElement>) {
    setEmail(e.target.value);
  }

  function handleSubmit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();

    if (!email) {
      setError("Please enter your email address.");
      return;
    }
    if (!EMAIL_PATTERN.test(email)) {
      setError("Please enter a valid email address.");
      return;
    }

    setError("");
    forgotPasswordMutation.mutate(email);
  }

  if (result) {
    return (
      <div className="min-h-screen bg-background text-body-text font-sans flex items-center justify-center px-4 py-12">
        <Card className="w-full max-w-[480px]">
          <div className="p-6">
            <p className="text-center text-3xl font-extrabold text-user-teal-end">SpaceSnap</p>
            <h1 className="text-center text-3xl font-extrabold text-white mt-4">Check your email</h1>
            <p className="text-center text-muted-text mt-2">{result.message}</p>

            {result.resetUrl && (
              <div className="mt-6 rounded border border-amber/40 bg-amber/10 p-4">
                <p className="text-xs font-semibold text-amber uppercase tracking-wide">
                  Dev only — email sending isn&apos;t wired up yet
                </p>
                <p className="text-sm text-body-text mt-2">
                  In production this link would be emailed to you. For now, here it is directly:
                </p>
                <Link
                  href={result.resetUrl}
                  className="block mt-2 text-sm text-user-teal-end hover:underline break-all"
                >
                  {result.resetUrl}
                </Link>
              </div>
            )}

            <p className="text-center text-sm mt-6">
              <Link href="/login" className="text-user-teal-end hover:underline">
                Back to log in
              </Link>
            </p>
          </div>
        </Card>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background text-body-text font-sans flex items-center justify-center px-4 py-12">
      <Card className="w-full max-w-[480px]">
        <div className="p-6">
          <p className="text-center text-3xl font-extrabold text-user-teal-end">SpaceSnap</p>
          <h1 className="text-center text-4xl font-extrabold text-white mt-4">Reset your password</h1>
          <p className="text-center text-muted-text mt-2 mb-8">
            Enter your account email and we&apos;ll send you a reset link.
          </p>

          <form className="space-y-4" onSubmit={handleSubmit} noValidate>
            <Input
              type="email"
              name="email"
              placeholder="you@example.com"
              className="w-full"
              value={email}
              onChange={handleChange}
            />

            {error && <p className="text-sm text-error-red">{error}</p>}

            <Button
              type="submit"
              className="w-full mt-2"
              disabled={forgotPasswordMutation.isPending}
            >
              {forgotPasswordMutation.isPending ? "Sending..." : "Send Reset Link"}
            </Button>
          </form>

          <p className="text-center text-sm mt-6">
            <Link href="/login" className="text-user-teal-end hover:underline">
              Back to log in
            </Link>
          </p>
        </div>
      </Card>
    </div>
  );
}
