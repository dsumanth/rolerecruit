"use client";

import { useMutation } from "convex/react";
import { api } from "@/convex/_generated/api";
import { authClient } from "@/lib/auth-client";
import { useRouter } from "next/navigation";
import { useState } from "react";
import type { ReactNode } from "react";
import { Button, Card, Input, Select } from "@/components/ui";

const BOARD_OPTIONS = [
  { value: "CBSE", label: "CBSE" },
  { value: "ICSE", label: "ICSE" },
  { value: "IB", label: "IB" },
  { value: "IGCSE", label: "IGCSE" },
  { value: "State", label: "State Board" },
];

export default function OnboardingPage() {
  const router = useRouter();
  const { data: session } = authClient.useSession();
  const userId = session?.user.id;
  const userEmail = session?.user.email ?? "";
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
        email: userEmail,
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
    <div>
      <h1 className="text-display-s text-ink mb-2">Welcome to RoleRecruit</h1>
      <p className="text-body-s text-ink-secondary mb-8">
        Create your school profile to start hiring.
      </p>

      <Card padding="lg" elevation={1}>
        <form onSubmit={handleSubmit} className="space-y-5">
          <Field label="Your name">
            <Input
              size="md"
              type="text"
              value={userName}
              onChange={(e) => setUserName(e.target.value)}
              placeholder="Priya Sharma"
              required
            />
          </Field>

          <Field label="School name">
            <Input
              size="md"
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="Delhi Public School"
              required
            />
          </Field>

          <Field label="Board">
            <Select
              value={board}
              onChange={setBoard}
              options={BOARD_OPTIONS}
              className="w-full"
            />
          </Field>

          <div className="grid grid-cols-2 gap-4">
            <Field label="City">
              <Input
                size="md"
                type="text"
                value={city}
                onChange={(e) => setCity(e.target.value)}
                placeholder="Hyderabad"
                required
              />
            </Field>
            <Field label="State">
              <Input
                size="md"
                type="text"
                value={state_}
                onChange={(e) => setState_(e.target.value)}
                placeholder="Telangana"
                required
              />
            </Field>
          </div>

          {error && (
            <div className="rounded-md bg-[color-mix(in_srgb,var(--danger)_8%,transparent)] border border-[color-mix(in_srgb,var(--danger)_25%,transparent)] px-4 py-3 text-body-s text-danger">
              {error}
            </div>
          )}

          <Button
            type="submit"
            variant="primary"
            size="lg"
            loading={loading}
            className="w-full"
          >
            Get started
          </Button>
        </form>
      </Card>
    </div>
  );
}

function Field({ label, children }: { label: string; children: ReactNode }) {
  return (
    <label className="block">
      <span className="block text-body-s font-medium text-ink mb-1.5">{label}</span>
      {children}
    </label>
  );
}
