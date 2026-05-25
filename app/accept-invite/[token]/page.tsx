import { fetchQuery } from "convex/nextjs";
import { api } from "@/convex/_generated/api";
import { AcceptInviteClient } from "./AcceptInviteClient";
import { notFound } from "next/navigation";

export default async function AcceptInvitePage({
  params,
}: {
  params: { token: string };
}) {
  const invite = await fetchQuery(api.invitations.getByToken, {
    token: params.token,
  });

  if (!invite) notFound();

  return <AcceptInviteClient invite={invite} token={params.token} />;
}
