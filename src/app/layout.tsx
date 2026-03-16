import type { Metadata } from "next";
import { Inter, Outfit } from "next/font/google";
import "./globals.css";

const inter = Inter({ subsets: ["latin"], variable: "--font-inter" });
const outfit = Outfit({ subsets: ["latin"], weight: ["400", "500", "600", "700", "800"], variable: "--font-outfit" });

export const metadata: Metadata = {
  title: "Opinion Factory",
  description: "Gerador de Pareceres Fiscais ABNT",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="pt-br" className={`${inter.variable} ${outfit.variable}`}>
      <body className="antialiased font-outfit">
        {children}
      </body>
    </html>
  );
}
