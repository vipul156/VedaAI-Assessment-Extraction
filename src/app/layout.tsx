import type { Metadata } from "next";
import { Inter } from "next/font/google";
import "./globals.css";

const inter = Inter({ subsets: ["latin"] });

export const metadata: Metadata = {
  title: "VedaAI — Assessment Extraction & Answer Mapping",
  description:
    "Upload a question paper and a handwritten answer sheet; AI extracts questions, maps answers, and grades with feedback.",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body className={`${inter.className} bg-[#F4F5F7] text-[#1F2937] antialiased`}>
        {children}
      </body>
    </html>
  );
}
