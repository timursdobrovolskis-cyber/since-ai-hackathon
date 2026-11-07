import type { Metadata, Viewport } from "next";
import { JetBrains_Mono } from "next/font/google";
import localFont from "next/font/local";
import "uplot/dist/uPlot.min.css";
import "react-isokit/styles.css";
import "./globals.css";
import { AppProvider } from "@/components/AppProvider";
import { Shell } from "@/components/Shell";
import { SmoothScroll } from "@/components/SmoothScroll";

// Fontshare fonts are self-hosted from app/fonts, so the app works offline and sends no requests to a font CDN.
const clash = localFont({
  src: [
    { path: "./fonts/ClashDisplay-Semibold.woff2", weight: "600" },
    { path: "./fonts/ClashDisplay-Bold.woff2", weight: "700" },
  ],
  variable: "--font-clash",
  display: "swap",
});
const satoshi = localFont({
  src: [
    { path: "./fonts/Satoshi-Regular.woff2", weight: "400" },
    { path: "./fonts/Satoshi-Medium.woff2", weight: "500" },
    { path: "./fonts/Satoshi-Bold.woff2", weight: "700" },
  ],
  variable: "--font-satoshi",
  display: "swap",
});
const mono = JetBrains_Mono({ subsets: ["latin"], weight: ["400", "500", "600"], variable: "--font-jetbrains" });

export const metadata: Metadata = {
  title: "Retrosense",
  description: "Early, explainable warnings for existing cooling-water pumps. Advisory only, on simulated data.",
};

export const viewport: Viewport = { width: "device-width", initialScale: 1, themeColor: "#0a0a0a", colorScheme: "dark" };

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className={`${clash.variable} ${satoshi.variable} ${mono.variable}`}>
      <body>
        <SmoothScroll />
        <AppProvider>
          <Shell>{children}</Shell>
        </AppProvider>
      </body>
    </html>
  );
}
