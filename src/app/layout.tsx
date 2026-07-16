import type { Metadata, Viewport } from "next";
import { Inter, Geist_Mono } from "next/font/google";
import { ThemeProvider } from "@/components/theme-provider";
import { PwaRegister } from "@/components/pwa/pwa-register";
import { Toaster } from "@/components/ui/sonner";
import { FeedbackToast } from "@/components/ui/feedback-toast";
import "./globals.css";

const inter = Inter({
  variable: "--font-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "Infinoos WMS",
  description: "WMS proprietário da Infinoos para operações logísticas multi-tenant.",
  manifest: "/manifest.webmanifest",
  appleWebApp: {
    capable: true,
    statusBarStyle: "black-translucent",
    title: "Infinoos WMS",
  },
  icons: {
    apple: [{ url: "/branding/infinoos-mark-192.png", sizes: "192x192", type: "image/png" }],
    icon: [
      { url: "/branding/infinoos-mark-192.png", sizes: "192x192", type: "image/png" },
      { url: "/branding/infinoos-mark-512.png", sizes: "512x512", type: "image/png" },
    ],
    shortcut: ["/branding/infinoos-mark-192.png"],
  },
};

export const viewport: Viewport = {
  themeColor: "#040816",
  width: "device-width",
  initialScale: 1,
  viewportFit: "cover",
};

export const preferredRegion = "gru1";

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html
      lang="pt-BR"
      suppressHydrationWarning
      className={`${inter.variable} ${geistMono.variable} h-full antialiased`}
    >
      <body className="min-h-full theme-transition font-sans">
        <PwaRegister />
        <ThemeProvider
          attribute="class"
          defaultTheme="dark"
          enableSystem={true}
          disableTransitionOnChange={false}
        >
          {children}
          <Toaster position="top-right" />
          <FeedbackToast />
        </ThemeProvider>
      </body>
    </html>
  );
}
