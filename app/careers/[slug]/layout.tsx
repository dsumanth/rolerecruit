import { fetchQuery } from "convex/nextjs";
import { api } from "@/convex/_generated/api";
import { MarketingTopbar } from "@/components/careers/MarketingTopbar";

export default async function SchoolLayout({
  children,
  params,
}: {
  children: React.ReactNode;
  params: { slug: string };
}) {
  const school = await fetchQuery(api.careers.getSchoolBySlug, { slug: params.slug });

  if (!school) {
    return <>{children}</>;
  }

  return (
    <>
      <MarketingTopbar schoolName={school.name} schoolSlug={params.slug} />
      {children}
    </>
  );
}
