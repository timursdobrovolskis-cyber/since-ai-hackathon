import type { Metadata, Viewport } from "next";
import { Geist, JetBrains_Mono } from "next/font/google";
import "./globals.css";
import { AppProvider } from "@/components/AppProvider";

// Geist for text, JetBrains Mono for measurements. Both under the SIL Open Font License.
const geist = Geist({ subsets: ["latin"], weight: ["300", "400", "500"], variable: "--ff-geist" });
const mono = JetBrains_Mono({ subsets: ["latin"], weight: ["400", "500"], variable: "--ff-mono" });

export const metadata: Metadata = {
  title: "Vahti",
  description: "Early, explainable warnings for existing cooling-water pumps. Advisory only, on simulated data.",
};

export const viewport: Viewport = { width: "device-width", initialScale: 1, themeColor: "#0b1014" };

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className={`${geist.variable} ${mono.variable}`}>
      <body>
        <AppProvider>{children}</AppProvider>
      </body>
    </html>
  );
}
