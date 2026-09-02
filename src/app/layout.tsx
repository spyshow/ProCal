import type { Metadata } from "next";
import { Inter, Rubik } from "next/font/google";
import Script from "next/script";
import "./globals.css";
import { ProjectProvider } from "@/context/ProjectContext";
import { I18nProvider } from "@/i18n";

const inter = Inter({
  subsets: ["latin"],
  display: "swap",
  variable: "--font-inter",
});

const rubikArabic = Rubik({
  subsets: ["arabic", "latin"],
  weight: ["300", "400", "500", "600", "700", "800", "900"],
  display: "swap",
  variable: "--font-rubik-arabic",
});

export const metadata: Metadata = {
  title: "ProCal – Electrical Load & MDB Designer",
  description:
    "Professional electrical engineering software for residential and commercial building load calculations, MDB panel design, cable sizing, and protection coordination.",
  icons: {
    icon: [
      { url: "/icon.svg", type: "image/svg+xml" },
      { url: "/icon.svg", sizes: "32x32" },
    ],
    apple: [{ url: "/icon.svg" }],
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html
      lang="en"
      className={`${inter.variable} ${rubikArabic.variable} h-full`}
      suppressHydrationWarning
    >
      <head>
        <Script
          id="microsoft-clarity"
          strategy="afterInteractive"
          dangerouslySetInnerHTML={{
            __html: `
              (function(c,l,a,r,i,t,y){
                  c[a]=c[a]||function(){(c[a].q=c[a].q||[]).push(arguments)};
                  t=l.createElement(r);t.async=1;t.src="https://www.clarity.ms/tag/"+i;
                  y=l.getElementsByTagName(r)[0];y.parentNode.insertBefore(t,y);
              })(window, document, "clarity", "script", "ybvkz2mik9");
            `,
          }}
        />
      </head>
      <body className="min-h-full bg-slate-950 text-slate-100 antialiased font-sans" suppressHydrationWarning>
        <I18nProvider>
          <ProjectProvider>{children}</ProjectProvider>
        </I18nProvider>
      </body>
    </html>
  );
}

