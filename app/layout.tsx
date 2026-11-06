import type { Metadata, Viewport } from "next";
import { Barlow, Barlow_Semi_Condensed } from "next/font/google";
import "uplot/dist/uPlot.min.css";
import "./globals.css";
import { AppProvider } from "@/components/AppProvider";
import { Shell } from "@/components/Shell";

const barlow = Barlow({ subsets: ["latin"], weight: ["400", "500", "600"], variable: "--font-barlow" });
const barlowCond = Barlow_Semi_Condensed({ subsets: ["latin"], weight: ["500", "600"], variable: "--font-barlow-cond" });

export const metadata: Metadata = {
  title: "Retrofit Assist",
  description: "Early, explainable warnings for existing cooling-water pumps. Advisory only, on simulated data.",
};

export const viewport: Viewport = { width: "device-width", initialScale: 1, themeColor: "#d5d8da" };

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className={`${barlow.variable} ${barlowCond.variable}`}>
      <body>
        <AppProvider>
          <Shell>{children}</Shell>
        </AppProvider>
      </body>
    </html>
  );
}
