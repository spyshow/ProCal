import type { Metadata } from "next";
import { Inter, Rubik } from "next/font/google";
import { cookies } from "next/headers";
import "./globals.css";
import { getSessionUser } from "@/lib/auth";
import { UserProvider } from "@/context/UserContext";
import { ProjectProvider } from "@/context/ProjectContext";
import { ThemeProvider } from "@/context/ThemeContext";
import { THEME_COOKIE_NAME, DEFAULT_THEME, isValidTheme } from "@/lib/theme";
import { I18nProvider } from "@/i18n";
import { LetsReplayAnalytics } from "@/components/LetsReplayAnalytics";

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
  title: "ProCal – Low Voltage Electrical Design , Solved",
  description:
    "ProCal — Low Voltage Electrical Design , Solved. Precision electrical engineering software for residential and commercial building load calculations, MDB panel design, cable sizing, and protection coordination.",
  icons: {
    icon: [
      { url: "/icon.svg", type: "image/svg+xml" },
      { url: "/favicon.ico", sizes: "any" },
    ],
    apple: [
      { url: "/apple-icon.svg", type: "image/svg+xml" },
      { url: "/apple-touch-icon.png", sizes: "180x180", type: "image/png" },
    ],
  },
};

export default async function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  const user = await getSessionUser();
  const cookieStore = await cookies();
  const themeCookie = cookieStore.get(THEME_COOKIE_NAME)?.value;
  const initialTheme = isValidTheme(user?.theme)
    ? user.theme
    : isValidTheme(themeCookie)
    ? themeCookie
    : DEFAULT_THEME;
  const resolvedDomTheme = initialTheme === 'system' ? 'dark' : initialTheme;

  return (
    <html
      lang="en"
      data-theme={resolvedDomTheme}
      className={`${inter.variable} ${rubikArabic.variable} ${resolvedDomTheme === 'dark' ? 'dark' : ''} h-full`}
      suppressHydrationWarning
    >
      <head>
        <script
          id="procal-theme-init"
          dangerouslySetInnerHTML={{
            __html: `(function(){try{var m=document.cookie.match(/(?:^|; )${THEME_COOKIE_NAME}=([^;]*)/);var t=m?decodeURIComponent(m[1]):null;if(!t){t=localStorage.getItem('${THEME_COOKIE_NAME}')}if(t==='blueprint'||t==='warm'||t==='dark'||t==='system'){var r=t;if(t==='system'){r=window.matchMedia('(prefers-color-scheme: dark)').matches?'dark':'blueprint'}var d=document.documentElement;d.dataset.theme=r;if(r==='dark'){d.classList.add('dark')}else{d.classList.remove('dark')}}}catch(e){}})();`,
          }}
        />
        <LetsReplayAnalytics />
      </head>
      <body className="min-h-full bg-[var(--background-color,#030712)] text-[var(--foreground-color,#f8fafc)] antialiased font-sans" suppressHydrationWarning>
        <I18nProvider>
          <UserProvider user={user}>
            <ThemeProvider initialTheme={initialTheme}>
              <ProjectProvider>{children}</ProjectProvider>
            </ThemeProvider>
          </UserProvider>
        </I18nProvider>
      </body>
    </html>
  );
}

