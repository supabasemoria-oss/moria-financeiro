import type { Metadata, Viewport } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import { TooltipProvider } from "@/components/ui/tooltip";
import { Toaster } from "@/components/ui/sonner";
import { SystemProvider } from "@/contexts/system-context";
import { FiltroGlobalProvider } from "@/contexts/filtro-global-context";
import "./globals.css";

const geistSans = Geist({
  variable: "--font-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-mono",
  subsets: ["latin"],
});

export const viewport: Viewport = {
  themeColor: "#1a1a2e",
};

export const metadata: Metadata = {
  title: "MROSC Gestão - Gestão de Parcerias",
  description: "Assessoria técnica e auditoria financeira para o Terceiro Setor (Lei 13.019/2014)",
  icons: {
    icon: [
      { url: "/logo-symbol.png", sizes: "any" },
      { url: "/icon.png", type: "image/png" },
    ],
    shortcut: "/logo-symbol.png",
    apple: "/logo-symbol.png",
  },
  manifest: "/manifest.json",
  appleWebApp: {
    capable: true,
    statusBarStyle: "default",
    title: "MROSC Gestão",
  },
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html
      lang="pt-BR"
      className={`${geistSans.variable} ${geistMono.variable} h-full antialiased`}
    >
      <body className="min-h-full flex flex-col font-sans bg-background text-foreground">
        <SystemProvider>
          <FiltroGlobalProvider>
            <TooltipProvider>
              {children}
              <Toaster richColors position="top-right" />
            </TooltipProvider>
          </FiltroGlobalProvider>
        </SystemProvider>
      </body>
    </html>
  );
}
