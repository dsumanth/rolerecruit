import { redirect } from "next/navigation";

export default function LegacyFeedbackRedirect({
  params,
}: {
  params: { token: string };
}) {
  redirect(`/evaluations/from-token?token=${encodeURIComponent(params.token)}`);
}
