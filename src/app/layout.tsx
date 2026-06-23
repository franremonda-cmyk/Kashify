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
  metadataBase: new URL("https://kashify.vercel.app"),
  title: { default: "Kashify — Finanzas personales", template: "%s · Kashify" },
  description: "Tus finanzas, por WhatsApp. Con Neo, tu asistente personal.",
  applicationName: "Kashify",
  manifest: "/manifest.json",
  appleWebApp: { capable: true, statusBarStyle: "default", title: "Kashify" },
  openGraph: {
    type: "website",
    siteName: "Kashify",
    title: "Kashify — Tus finanzas, claras y al día.",
    description: "Cargá gastos por WhatsApp. Neo, tu asistente, ordena todo por vos.",
    url: "https://kashify.vercel.app",
    locale: "es_AR",
  },
  twitter: {
    card: "summary_large_image",
    title: "Kashify — Tus finanzas, claras y al día.",
    description: "Cargá gastos por WhatsApp. Neo, tu asistente, ordena todo por vos.",
  },
};

export const viewport: Viewport = {
  themeColor: "#121517",
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
