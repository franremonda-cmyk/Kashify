import type { Metadata, Viewport } from "next";
import { DM_Sans, DM_Mono, Space_Grotesk } from "next/font/google";
import "./globals.css";
import SplashScreen from "@/components/SplashScreen";
import ThemeLoader from "@/components/ThemeLoader";
import { IconStyleProvider } from "@/context/IconStyleContext";

const dmSans = DM_Sans({
  subsets: ["latin"],
  variable: "--font-sans",
  display: "swap",
  weight: ["300", "400", "500", "600"],
});

const dmMono = DM_Mono({
  subsets: ["latin"],
  weight: ["400", "500"],
  variable: "--font-mono",
  display: "swap",
});

const spaceGrotesk = Space_Grotesk({
  subsets: ["latin"],
  variable: "--font-display",
  display: "swap",
  weight: ["400", "500", "600", "700"],
});

export const metadata: Metadata = {
  title: "Kashify",
  description: "Tus finanzas, por WhatsApp. Con Neo.",
  manifest: "/manifest.json",
  appleWebApp: { capable: true, statusBarStyle: "default", title: "Kashify" },
};

export const viewport: Viewport = {
  themeColor: "#06090B",
  width: "device-width",
  initialScale: 1,
  maximumScale: 1, // evita el auto-zoom de iOS Safari al enfocar inputs (se ve "más grande y corrido")
  userScalable: false,
  viewportFit: "cover", // habilita env(safe-area-inset-*) en notch/Dynamic Island
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="es" className={`${dmSans.variable} ${dmMono.variable} ${spaceGrotesk.variable}`}>
      <body>
        <ThemeLoader />
        <SplashScreen />
        <IconStyleProvider>
          {children}
        </IconStyleProvider>
      </body>
    </html>
  );
}
