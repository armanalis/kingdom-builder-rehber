import type { Metadata, Viewport } from "next";
import { Fraunces, Nunito } from "next/font/google";
import "./globals.css";
import { LanguageProvider } from "./components/i18n";
import { OnboardingGate } from "./components/Onboarding";

const display = Fraunces({
  variable: "--font-display",
  subsets: ["latin", "latin-ext"],
  weight: ["600", "700"],
});

const body = Nunito({
  variable: "--font-body",
  subsets: ["latin", "latin-ext"],
});

export const metadata: Metadata = {
  title: "Kingdom Builder · Kural Hakemi / Rules Referee",
  description: "Kingdom Builder kurallarını sesli veya yazılı sorun, skorları tutun. Ask Kingdom Builder rules by voice and keep score.",
  appleWebApp: { capable: true, title: "Kural Hakemi", statusBarStyle: "default" },
};

export const viewport: Viewport = {
  themeColor: "#2f5d3a",
  viewportFit: "cover",
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="tr" className={`${display.variable} ${body.variable}`}>
      <body>
        <LanguageProvider>
          <OnboardingGate>{children}</OnboardingGate>
        </LanguageProvider>
      </body>
    </html>
  );
}
