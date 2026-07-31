"use client";

import { Suspense, useState, type ChangeEvent, type FormEvent } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { useMutation } from "@tanstack/react-query";
import Link from "next/link";
import Card from "@/components/Card";
import Input from "@/components/Input";
import Button from "@/components/Button";

interface ResetPasswordFormData {
  password: string;
  confirmPassword: string;
}

function ResetPasswordForm() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const token = searchParams.get("token") ?? "";

  const [formData, setFormData] = useState<ResetPasswordFormData>({
    password: "",
    confirmPassword: "",
  });
  const [error, setError] = useState("");
  const [success, setSuccess] = useState(false);

  const resetPasswordMutation = useMutation({
    mutationFn: async (password: string) => {
      const response = await fetch("/api/auth/reset-password", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ token, password }),
      });
      const data = await response.json().catch(() => null);
      if (!response.ok) {
        throw new Error(data?.message || "Something went wrong. Please try again.");
      }
      return data;
    },
    onSuccess: () => setSuccess(true),
    onError: (err: Error) => setError(err.message),
  });

  function handleChange(e: ChangeEvent<HTMLInputElement>) {
    const { name, value } = e.target;
    setFormData((prev) => ({ ...prev, [name]: value }));
  }

  function handleSubmit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();

    if (!token) {
      setError("This reset link is missing its token. Request a new one.");
      return;
    }
    if (!formData.password || !formData.confirmPassword) {
      setError("Please fill in both fields.");
      return;
    }
    if (formData.password.length < 8) {
      setError("Password must be at least 8 characters.");
      return;
    }
    if (formData.password !== formData.confirmPassword) {
      setError("Passwords do not match.");
      return;
    }

    setError("");
    resetPasswordMutation.mutate(formData.password);
  }

  if (success) {
    return (
      <Card className="w-full max-w-[480px]">
        <div className="p-6">
          <p className="text-center text-3xl font-extrabold text-user-teal-end">SpaceSnap</p>
          <h1 className="text-center text-3xl font-extrabold text-white mt-4">Password updated</h1>
          <p className="text-center text-muted-text mt-2">
            Your password has been changed. You can now sign in with your new password.
          </p>
          <Button className="w-full mt-6" onClick={() => router.push("/login")}>
            Continue to Login
          </Button>
        </div>
      </Card>
    );
  }

  return (
    <Card className="w-full max-w-[480px]">
      <div className="p-6">
        <p className="text-center text-3xl font-extrabold text-user-teal-end">SpaceSnap</p>
        <h1 className="text-center text-4xl font-extrabold text-white mt-4">Set a new password</h1>
        <p className="text-center text-muted-text mt-2 mb-8">
          Choose a new password for your account.
        </p>

        {!token && (
          <p className="text-sm text-error-red mb-4 text-center">
            This link is missing its reset token — check the link you followed, or{" "}
            <Link href="/forgot-password" className="underline">
              request a new one
            </Link>
            .
          </p>
        )}

        <form className="space-y-4" onSubmit={handleSubmit} noValidate>
          <Input
            type="password"
            name="password"
            placeholder="New password"
            className="w-full"
            value={formData.password}
            onChange={handleChange}
          />
          <Input
            type="password"
            name="confirmPassword"
            placeholder="Confirm new password"
            className="w-full"
            value={formData.confirmPassword}
            onChange={handleChange}
          />

          {error && <p className="text-sm text-error-red">{error}</p>}

          <Button
            type="submit"
            className="w-full mt-2"
            disabled={resetPasswordMutation.isPending}
          >
            {resetPasswordMutation.isPending ? "Updating..." : "Update Password"}
          </Button>
        </form>

        <p className="text-center text-sm mt-6">
          <Link href="/login" className="text-user-teal-end hover:underline">
            Back to log in
          </Link>
        </p>
      </div>
    </Card>
  );
}

export default function ResetPasswordPage() {
  return (
    <div className="min-h-screen bg-background text-body-text font-sans flex items-center justify-center px-4 py-12">
      <Suspense fallback={null}>
        <ResetPasswordForm />
      </Suspense>
    </div>
  );
}
