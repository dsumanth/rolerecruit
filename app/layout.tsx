import type { Metadata } from "next";
import { ClerkProvider } from "@clerk/nextjs";
import "./globals.css";

export const metadata: Metadata = {
  title: "RoleRecruit",
  description: "AI-powered hiring for schools",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <ClerkProvider>
      <html lang="en">
        <body className="min-h-screen bg-surface-secondary text-ink antialiased">
          {children}
        </body>
      </html>
    </ClerkProvider>
  );
}
