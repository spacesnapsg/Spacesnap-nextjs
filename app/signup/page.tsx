"use client";

import { useEffect, useState, type ChangeEvent, type FormEvent } from "react";
import { useRouter } from "next/navigation";
import { useSession } from "next-auth/react";
import { useMutation } from "@tanstack/react-query";
import Link from "next/link";
import { User, Boxes, Scale, type LucideIcon } from "lucide-react";
import Card from "@/components/Card";
import Input from "@/components/Input";
import Button from "@/components/Button";
import OrgSearchInput from "@/components/OrgSearchInput";
import { getRoleHome } from "@/lib/role-home";

type Role = "member" | "supplier" | "both";

interface SignupFormData {
  fullName: string;
  email: string;
  buyerOrganizationName: string;
  companyName: string;
  password: string;
  confirmPassword: string;
  role: Role | null;
  agreedToTerms: boolean;
  agreedToPrivacy: boolean;
  referralCode: string;
}

interface OrganizationResult {
  status: "joined" | "pending";
  name: string;
}

interface RegisterResponse {
  organizationResults: {
    buyerOrganization?: OrganizationResult;
    company?: OrganizationResult;
  };
}

interface RoleOption {
  id: Role;
  label: string;
  description: string;
  icon: LucideIcon;
  iconBg: string;
  selectedBorder: string;
}

const ROLES: RoleOption[] = [
  {
    id: "member",
    label: "Member",
    description: "Book spaces & manage credits",
    icon: User,
    iconBg: "bg-user-teal-start",
    selectedBorder: "border-user-teal-end",
  },
  {
    id: "supplier",
    label: "Supplier",
    description: "List and manage your spaces",
    icon: Boxes,
    iconBg: "bg-supplier-purple-start",
    selectedBorder: "border-supplier-purple-start",
  },
  {
    id: "both",
    label: "Both",
    description: "Full access to all features",
    icon: Scale,
    iconBg: "bg-gradient-to-br from-user-teal-start to-supplier-purple-start",
    selectedBorder:
      "border-transparent [background:linear-gradient(#151a23,#151a23)_padding-box,linear-gradient(135deg,#4db8b0,#9333ea)_border-box]",
  },
];

const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

interface RegisterFields {
  name: string;
  email: string;
  password: string;
  referralCode?: string;
  role?: Role;
  buyerOrganizationName?: string;
  companyName?: string;
}

export default function SignupPage() {
  const router = useRouter();
  const { data: session, status } = useSession();
  const [formData, setFormData] = useState<SignupFormData>({
    fullName: "",
    email: "",
    buyerOrganizationName: "",
    companyName: "",
    password: "",
    confirmPassword: "",
    role: null,
    agreedToTerms: false,
    agreedToPrivacy: false,
    referralCode: "",
  });
  const [error, setError] = useState("");
  const [organizationResults, setOrganizationResults] = useState<
    RegisterResponse["organizationResults"] | null
  >(null);

  useEffect(() => {
    if (status === "authenticated" && session?.user) {
      router.replace(getRoleHome(session.user));
    }
  }, [status, session, router]);

  // 2026-07-23: role/buyerOrganizationName/companyName are now real fields
  // the register endpoint resolves (search-or-create against
  // BuyerOrganization/Company) — previously collected here and silently
  // dropped, see SPRINT_PLAN_NEXTJS_REWRITE.md "Sprint 7.1".
  const registerMutation = useMutation({
    mutationFn: async (fields: RegisterFields): Promise<RegisterResponse> => {
      const response = await fetch("/api/auth/register", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(fields),
      });

      const data = await response.json().catch(() => null);
      if (!response.ok) {
        throw new Error(data?.message || "Unable to create your account. Please try again.");
      }
      return data as RegisterResponse;
    },
    onSuccess: (data) => {
      setOrganizationResults(data.organizationResults);
    },
    onError: (err: Error) => {
      setError(err.message);
    },
  });

  function handleChange(e: ChangeEvent<HTMLInputElement>) {
    const { name, value } = e.target;
    setFormData((prev) => ({ ...prev, [name]: value }));
  }

  function handleSubmit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();

    if (
      !formData.fullName ||
      !formData.email ||
      !formData.password ||
      !formData.confirmPassword
    ) {
      setError("Please fill in all fields.");
      return;
    }
    if (!EMAIL_PATTERN.test(formData.email)) {
      setError("Please enter a valid email address.");
      return;
    }
    if (formData.password !== formData.confirmPassword) {
      setError("Passwords do not match.");
      return;
    }
    if ((formData.role === "supplier" || formData.role === "both") && !formData.companyName.trim()) {
      setError("Company name is required for a supplier account.");
      return;
    }

    setError("");
    registerMutation.mutate({
      name: formData.fullName,
      email: formData.email,
      password: formData.password,
      referralCode: formData.referralCode.trim() || undefined,
      role: formData.role ?? undefined,
      buyerOrganizationName:
        formData.role === "member" || formData.role === "both"
          ? formData.buyerOrganizationName.trim() || undefined
          : undefined,
      companyName:
        formData.role === "supplier" || formData.role === "both"
          ? formData.companyName.trim() || undefined
          : undefined,
    });
  }

  if (status === "authenticated") return null;

  if (organizationResults) {
    const { buyerOrganization, company } = organizationResults;
    return (
      <div className="min-h-screen bg-background text-body-text font-sans flex items-center justify-center px-4 py-12">
        <Card className="w-full max-w-[480px]">
          <div className="p-6">
            <p className="text-center text-3xl font-extrabold text-user-teal-end">SpaceSnap</p>
            <h1 className="text-center text-3xl font-extrabold text-white mt-4">Account created</h1>

            <div className="mt-6 space-y-3">
              {buyerOrganization && (
                <p className="text-sm text-body-text bg-white/5 rounded p-3">
                  {buyerOrganization.status === "joined"
                    ? `You're in — ${buyerOrganization.name}.`
                    : `Your request to join ${buyerOrganization.name} is pending approval from their organization admin.`}
                </p>
              )}
              {company && (
                <p className="text-sm text-body-text bg-white/5 rounded p-3">
                  {company.status === "joined"
                    ? `You're in — ${company.name}.`
                    : `Your request to join ${company.name} is pending approval from their company admin.`}
                </p>
              )}
              {!buyerOrganization && !company && (
                <p className="text-sm text-muted-text">Your account is ready.</p>
              )}
            </div>

            <Button className="w-full mt-6" onClick={() => router.push("/login")}>
              Continue to Login
            </Button>
          </div>
        </Card>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background text-body-text font-sans flex items-center justify-center px-4 py-12">
      <Card className="w-full max-w-[480px]">
        <div className="p-6">
          <p className="text-center text-3xl font-extrabold text-user-teal-end">
            SpaceSnap
          </p>
          <h1 className="text-center text-4xl font-extrabold text-white mt-4">
            Create your account
          </h1>
          <p className="text-center text-muted-text mt-2 mb-8">
            Choose how you want to use SpaceSnap
          </p>

          <div className="grid grid-cols-3 gap-3 mb-8">
            {ROLES.map(
              ({ id, label, description, icon: Icon, iconBg, selectedBorder }) => (
                <button
                  key={id}
                  type="button"
                  onClick={() => setFormData((prev) => ({ ...prev, role: id }))}
                  className={`flex flex-col items-center text-center gap-2 rounded-xl border p-3 transition-colors ${
                    formData.role === id
                      ? selectedBorder
                      : "border-border hover:border-border/70"
                  }`}
                >
                  <span
                    className={`flex items-center justify-center w-10 h-10 rounded-full text-white ${iconBg}`}
                  >
                    <Icon size={18} />
                  </span>
                  <span className="font-semibold text-white text-sm">
                    {label}
                  </span>
                  <span className="text-xs text-muted-text leading-snug">
                    {description}
                  </span>
                </button>
              )
            )}
          </div>

          <form className="space-y-4" onSubmit={handleSubmit} noValidate>
            <Input
              name="fullName"
              placeholder="John Doe"
              className="w-full"
              value={formData.fullName}
              onChange={handleChange}
            />
            <Input
              type="email"
              name="email"
              placeholder="you@example.com"
              className="w-full"
              value={formData.email}
              onChange={handleChange}
            />
            {(formData.role === "member" || formData.role === "both") && (
              <OrgSearchInput
                value={formData.buyerOrganizationName}
                onChange={(value) => setFormData((prev) => ({ ...prev, buyerOrganizationName: value }))}
                searchUrl="/api/buyer-organizations/search"
                resultsKey="organizations"
                placeholder="Organization (optional) — search or create new"
              />
            )}
            {(formData.role === "supplier" || formData.role === "both") && (
              <OrgSearchInput
                value={formData.companyName}
                onChange={(value) => setFormData((prev) => ({ ...prev, companyName: value }))}
                searchUrl="/api/companies/search"
                resultsKey="companies"
                placeholder="Company — search or create new"
              />
            )}
            <Input
              type="password"
              name="password"
              placeholder="Create a password"
              className="w-full"
              value={formData.password}
              onChange={handleChange}
            />
            <Input
              type="password"
              name="confirmPassword"
              placeholder="Confirm your password"
              className="w-full"
              value={formData.confirmPassword}
              onChange={handleChange}
            />
            <Input
              name="referralCode"
              placeholder="Referral code (optional)"
              className="w-full"
              value={formData.referralCode}
              onChange={handleChange}
            />

            <div className="space-y-4 pt-2">
              <label className="flex items-start gap-3 text-sm text-body-text">
                <input
                  type="checkbox"
                  checked={formData.agreedToTerms}
                  onChange={(e) =>
                    setFormData((prev) => ({
                      ...prev,
                      agreedToTerms: e.target.checked,
                    }))
                  }
                  className="mt-1 accent-user-teal-start shrink-0"
                />
                <span>
                  I have read, understood and agree to the Terms of Service of
                  SpaceSnap.
                  <br />
                  <Link href="#" className="text-user-teal-end hover:underline">
                    Click here to read the Terms of Service.
                  </Link>
                </span>
              </label>
              <label className="flex items-start gap-3 text-sm text-body-text">
                <input
                  type="checkbox"
                  checked={formData.agreedToPrivacy}
                  onChange={(e) =>
                    setFormData((prev) => ({
                      ...prev,
                      agreedToPrivacy: e.target.checked,
                    }))
                  }
                  className="mt-1 accent-user-teal-start shrink-0"
                />
                <span>
                  I have read, understood and agree to the Privacy Policy of
                  SpaceSnap.
                  <br />
                  <Link href="#" className="text-user-teal-end hover:underline">
                    Click here to read the Privacy Policy.
                  </Link>
                </span>
              </label>
            </div>

            {error && <p className="text-sm text-error-red">{error}</p>}

            <Button type="submit" className="w-full mt-2" disabled={registerMutation.isPending}>
              {registerMutation.isPending ? "Creating Account..." : "Create Account"}
            </Button>
          </form>

          <p className="text-center text-sm mt-6">
            <Link href="/login" className="text-user-teal-end hover:underline">
              Already have an account? Log in
            </Link>
          </p>
        </div>
      </Card>
    </div>
  );
}
