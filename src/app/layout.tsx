import type { Metadata } from "next";
import { Inter } from "next/font/google";
import "./globals.css";
import { ProjectProvider } from "@/context/ProjectContext";

const inter = Inter({
  subsets: ["latin"],
  variable: "--font-inter",
});

export const metadata: Metadata = {
  title: "ProCal – Electrical Load & MDB Designer",
  description:
    "Professional electrical engineering software for residential and commercial building load calculations, MDB panel design, cable sizing, and protection coordination.",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" className={`${inter.variable} h-full`}>
      <body className="min-h-full bg-gray-950 text-gray-100 antialiased">
        <ProjectProvider>{children}</ProjectProvider>
      </body>
    </html>
  );
}
