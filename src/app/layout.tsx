import type { Metadata, Viewport } from "next";
import { Inter, Geist_Mono, Manrope, Space_Grotesk, JetBrains_Mono } from "next/font/google";
import { ThemeProvider } from "@/components/theme-provider";
import { PwaRegister } from "@/components/pwa/pwa-register";
import { Toaster } from "@/components/ui/sonner";
import { FeedbackToast } from "@/components/ui/feedback-toast";
import { getBrand } from "@/lib/brand";
import "./globals.css";

const brand = getBrand();

const inter = Inter({
  variable: "--font-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

const manrope = Manrope({
  variable: "--font-manrope",
  subsets: ["latin"],
});

const spaceGrotesk = Space_Grotesk({
  variable: "--font-space-grotesk",
  subsets: ["latin"],
});

const jetbrainsMono = JetBrains_Mono({
  variable: "--font-jetbrains-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: brand.productName,
  description: brand.description ?? "WMS proprietário da Infinoos para operações logísticas multi-tenant.",
  manifest: "/manifest.webmanifest",
  appleWebApp: {
    capable: true,
    statusBarStyle: "black-translucent",
    title: brand.shortName,
  },
  icons: {
    // O apple-touch-icon precisa ser quadrado e opaco: o iOS aplica o próprio
    // recorte e preenche transparência com preto. Por isso ele aponta para um
    // arquivo dedicado, e não para os ícones arredondados usados no resto.
    apple: [{ url: "/branding/infinoos-mark-apple-180.png", sizes: "180x180", type: "image/png" }],
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
      className={`${inter.variable} ${geistMono.variable} ${manrope.variable} ${spaceGrotesk.variable} ${jetbrainsMono.variable} h-full antialiased`}
    >
      <body className="min-h-full theme-transition font-sans">
        <PwaRegister />
        <ThemeProvider
          attribute="class"
          defaultTheme="dark"
          enableSystem={false}
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
