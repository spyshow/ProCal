import type { Metadata } from "next";
import { Inter, IBM_Plex_Sans_Arabic } from "next/font/google";
import "./globals.css";
import { ProjectProvider } from "@/context/ProjectContext";
import { I18nProvider } from "@/i18n";

const inter = Inter({
  subsets: ["latin"],
  display: "swap",
  variable: "--font-inter",
});

const ibmPlexArabic = IBM_Plex_Sans_Arabic({
  subsets: ["arabic"],
  weight: ["400", "500", "600", "700"],
  display: "swap",
  variable: "--font-ibm-arabic",
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
    <html
      lang="en"
      className={`${inter.variable} ${ibmPlexArabic.variable} h-full`}
      suppressHydrationWarning
    >
      <body className="min-h-full bg-slate-950 text-slate-100 antialiased font-sans" suppressHydrationWarning>
        <I18nProvider>
          <ProjectProvider>{children}</ProjectProvider>
        </I18nProvider>
      </body>
    </html>
  );
}

