import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Zombie Brand Scout",
  description:
    "Surface abandoned Australian trademarks ripe for revival — powered by IP Australia and Gemini.",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en">
      <body className="antialiased">{children}</body>
    </html>
  );
}
