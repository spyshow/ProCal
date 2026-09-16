import type { Metadata } from "next";
import { Inter, Rubik } from "next/font/google";
import { cookies } from "next/headers";
import Script from "next/script";
import "./globals.css";
import { ProjectProvider } from "@/context/ProjectContext";
import { ThemeProvider } from "@/context/ThemeContext";
import { THEME_COOKIE_NAME, DEFAULT_THEME, isValidTheme } from "@/lib/theme";
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
  title: "ProCal – Low-voltage Electrical design, Solved",
  description:
    "ProCal — Low-voltage Electrical design, Solved. Precision electrical engineering software for residential and commercial building load calculations, MDB panel design, cable sizing, and protection coordination.",
  icons: {
    icon: [
      { url: "/icon.svg", type: "image/svg+xml" },
      { url: "/icon.svg", sizes: "32x32" },
    ],
    apple: [{ url: "/icon.svg" }],
  },
};

export default async function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  const cookieStore = await cookies();
  const themeCookie = cookieStore.get(THEME_COOKIE_NAME)?.value;
  const initialTheme = isValidTheme(themeCookie) ? themeCookie : DEFAULT_THEME;
  const resolvedDomTheme = initialTheme === 'system' ? 'dark' : initialTheme;

  return (
    <html
      lang="en"
      data-theme={resolvedDomTheme}
      className={`${inter.variable} ${rubikArabic.variable} ${resolvedDomTheme === 'dark' ? 'dark' : ''} h-full`}
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
      <body className="min-h-full bg-[var(--background-color,#030712)] text-[var(--foreground-color,#f8fafc)] antialiased font-sans" suppressHydrationWarning>
        <I18nProvider>
          <ThemeProvider initialTheme={initialTheme}>
            <ProjectProvider>{children}</ProjectProvider>
          </ThemeProvider>
        </I18nProvider>
      </body>
    </html>
  );
}

