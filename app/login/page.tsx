"use client";

import { useState, type ChangeEvent, type FormEvent } from "react";
import { useRouter } from "next/navigation";
import { signIn, getSession } from "next-auth/react";
import Link from "next/link";
import Card from "@/components/Card";
import Input from "@/components/Input";
import Button from "@/components/Button";

interface LoginFormData {
  email: string;
  password: string;
}

const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export default function LoginPage() {
  const router = useRouter();
  const [formData, setFormData] = useState<LoginFormData>({
    email: "",
    password: "",
  });
  const [error, setError] = useState("");
  const [submitting, setSubmitting] = useState(false);

  function handleChange(e: ChangeEvent<HTMLInputElement>) {
    const { name, value } = e.target;
    setFormData((prev) => ({ ...prev, [name]: value }));
  }

  async function handleSubmit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();

    if (!formData.email || !formData.password) {
      setError("Please fill in all fields.");
      return;
    }
    if (!EMAIL_PATTERN.test(formData.email)) {
      setError("Please enter a valid email address.");
      return;
    }

    setError("");
    setSubmitting(true);

    const result = await signIn("credentials", {
      email: formData.email,
      password: formData.password,
      redirect: false,
    });

    if (!result || result.error) {
      setSubmitting(false);
      setError("The provided credentials are incorrect.");
      return;
    }

    const session = await getSession();
    const user = session?.user;
    if (user?.isSystemAdmin) router.push("/admin/dashboard");
    else if (user?.isSupplier) router.push("/supplier");
    else router.push("/user");
  }

  return (
    <div className="min-h-screen bg-background text-body-text font-sans flex items-center justify-center px-4 py-12">
      <Card className="w-full max-w-[480px]">
        <div className="p-6">
          <p className="text-center text-3xl font-extrabold text-user-teal-end">
            SpaceSnap
          </p>
          <h1 className="text-center text-4xl font-extrabold text-white mt-4">
            Welcome back
          </h1>
          <p className="text-center text-muted-text mt-2 mb-8">
            Sign in to your account
          </p>

          <form className="space-y-4" onSubmit={handleSubmit} noValidate>
            <Input
              type="email"
              name="email"
              placeholder="you@example.com"
              className="w-full"
              value={formData.email}
              onChange={handleChange}
            />
            <Input
              type="password"
              name="password"
              placeholder="Enter your password"
              className="w-full"
              value={formData.password}
              onChange={handleChange}
            />

            <div className="text-right">
              <Link
                href="#"
                className="text-sm text-user-teal-end hover:underline"
              >
                Forgot password?
              </Link>
            </div>

            {error && <p className="text-sm text-error-red">{error}</p>}

            <Button type="submit" className="w-full mt-2" disabled={submitting}>
              {submitting ? "Signing In..." : "Sign In"}
            </Button>
          </form>

          <p className="text-center text-sm mt-6">
            <Link
              href="/signup"
              className="text-user-teal-end hover:underline"
            >
              Don&apos;t have an account? Sign up
            </Link>
          </p>
        </div>
      </Card>
    </div>
  );
}
