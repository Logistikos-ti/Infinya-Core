import type { Metadata, Viewport } from "next";
import { Inter, Geist_Mono } from "next/font/google";
import { ThemeProvider } from "@/components/theme-provider";
import { PwaRegister } from "@/components/pwa/pwa-register";
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
  title: "Infinya \u2022 Log",
  description: "WMS propriet\u00E1rio da Infinya para opera\u00E7\u00F5es log\u00EDsticas multi-tenant.",
  manifest: "/manifest.webmanifest",
  appleWebApp: {
    capable: true,
    statusBarStyle: "black-translucent",
    title: "Infinya Log",
  },
  icons: {
    apple: [{ url: "/branding/infinya-mark-192.png", sizes: "192x192", type: "image/png" }],
    icon: [
      { url: "/branding/infinya-mark-192.png", sizes: "192x192", type: "image/png" },
      { url: "/branding/infinya-mark-512.png", sizes: "512x512", type: "image/png" },
    ],
    shortcut: ["/branding/infinya-mark-192.png"],
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
        </ThemeProvider>
      </body>
    </html>
  );
}
