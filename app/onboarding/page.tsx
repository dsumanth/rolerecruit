"use client";

import { useMutation } from "convex/react";
import { api } from "@/convex/_generated/api";
import { useAuth } from "@clerk/nextjs";
import { useRouter } from "next/navigation";
import { useState } from "react";
import type { ReactNode } from "react";

export default function OnboardingPage() {
  const router = useRouter();
  const { userId } = useAuth();
  const createSchool = useMutation(api.schools.create);
  const createProfile = useMutation(api.users.createProfile);
  const [name, setName] = useState("");
  const [board, setBoard] = useState("CBSE");
  const [city, setCity] = useState("");
  const [state_, setState_] = useState("");
  const [userName, setUserName] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!userId) return;
    setError("");
    setLoading(true);

    try {
      const schoolId = await createSchool({
        name,
        board: board as "CBSE" | "ICSE" | "IB" | "State" | "IGCSE",
        city,
        state: state_,
      });

      await createProfile({
        userId,
        name: userName,
        email: "",
        schoolId,
        role: "hr_admin",
      });

      router.push("/dashboard");
    } catch (err: any) {
      setError(err.message || "Something went wrong");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-surface-secondary flex items-center justify-center">
      <div className="max-w-lg w-full mx-auto p-8">
        <h1 className="text-2xl font-bold tracking-tight text-ink mb-2">
          Set up your school
        </h1>
        <p className="text-ink-secondary mb-8">
          Create your school profile to start hiring.
        </p>

        <form onSubmit={handleSubmit} className="space-y-5">
          <Field label="Your name">
            <input
              type="text"
              value={userName}
              onChange={(e) => setUserName(e.target.value)}
              className="w-full px-4 py-2.5 rounded-apple bg-surface border border-surface-tertiary text-sm text-ink placeholder:text-ink-tertiary focus:outline-none focus:ring-2 focus:ring-[#0071e3] focus:border-transparent"
              placeholder="Priya Sharma"
              required
            />
          </Field>

          <Field label="School name">
            <input
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              className="w-full px-4 py-2.5 rounded-apple bg-surface border border-surface-tertiary text-sm text-ink placeholder:text-ink-tertiary focus:outline-none focus:ring-2 focus:ring-[#0071e3] focus:border-transparent"
              placeholder="Delhi Public School"
              required
            />
          </Field>

          <Field label="Board">
            <select
              value={board}
              onChange={(e) => setBoard(e.target.value)}
              className="w-full px-4 py-2.5 rounded-apple bg-surface border border-surface-tertiary text-sm text-ink focus:outline-none focus:ring-2 focus:ring-[#0071e3] focus:border-transparent appearance-none"
            >
              <option value="CBSE">CBSE</option>
              <option value="ICSE">ICSE</option>
              <option value="IB">IB</option>
              <option value="IGCSE">IGCSE</option>
              <option value="State">State Board</option>
            </select>
          </Field>

          <div className="grid grid-cols-2 gap-4">
            <Field label="City">
              <input
                type="text"
                value={city}
                onChange={(e) => setCity(e.target.value)}
                className="w-full px-4 py-2.5 rounded-apple bg-surface border border-surface-tertiary text-sm text-ink placeholder:text-ink-tertiary focus:outline-none focus:ring-2 focus:ring-[#0071e3] focus:border-transparent"
                placeholder="Hyderabad"
                required
              />
            </Field>
            <Field label="State">
              <input
                type="text"
                value={state_}
                onChange={(e) => setState_(e.target.value)}
                className="w-full px-4 py-2.5 rounded-apple bg-surface border border-surface-tertiary text-sm text-ink placeholder:text-ink-tertiary focus:outline-none focus:ring-2 focus:ring-[#0071e3] focus:border-transparent"
                placeholder="Telangana"
                required
              />
            </Field>
          </div>

          {error && (
            <div className="px-4 py-3 rounded-apple bg-[#fff2f0] text-sm text-[#ff3b30]">
              {error}
            </div>
          )}

          <button
            type="submit"
            disabled={loading}
            className="w-full py-2.5 rounded-apple bg-[#0071e3] text-white text-sm font-medium hover:bg-[#0077ed] active:bg-[#004999] disabled:opacity-50 transition-colors"
          >
            {loading ? "Creating..." : "Create School"}
          </button>
        </form>
      </div>
    </div>
  );
}

function Field({ label, children }: { label: string; children: ReactNode }) {
  return (
    <label className="block">
      <span className="block text-sm font-medium text-ink mb-1.5">{label}</span>
      {children}
    </label>
  );
}
