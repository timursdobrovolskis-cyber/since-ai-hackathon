// Fonts for the landing page only, so the worker screens keep Barlow and load nothing extra.
// Geist and JetBrains Mono are both under the SIL Open Font License.
import { Geist, JetBrains_Mono } from "next/font/google";

const geist = Geist({ subsets: ["latin"], weight: ["300", "400", "500"], variable: "--ff-geist" });
const mono = JetBrains_Mono({ subsets: ["latin"], weight: ["400", "500"], variable: "--ff-mono" });

export default function WelcomeLayout({ children }: { children: React.ReactNode }) {
  return <div className={`${geist.variable} ${mono.variable} h-full`}>{children}</div>;
}
