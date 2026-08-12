import "./globals.css";
import { Providers } from "@/components/Providers";
import ThemeProvider from "@/components/ThemeProvider";
import { Inter, Outfit, JetBrains_Mono } from 'next/font/google';

const inter = Inter({
  subsets: ['latin'],
  variable: '--font-sans',
});

const outfit = Outfit({
  subsets: ['latin'],
  variable: '--font-display',
});

const jetbrains = JetBrains_Mono({
  subsets: ['latin'],
  variable: '--font-mono',
});

export const metadata = {
  title: "IML Group - Inventory Management",
  description: "Secure, high-performance inventory tracking system by IML Group.",
  manifest: "/manifest.json",
  icons: {
    icon: "/IML LOGO H-C.png",
    shortcut: "/IML LOGO H-C.png",
    apple: "/IML LOGO H-C.png",
  }
};

export default function RootLayout({ children }) {
  return (
    <html lang="en" className={`${inter.variable} ${outfit.variable} ${jetbrains.variable}`}>
      <body className="bg-background text-text-primary antialiased min-h-screen overflow-x-hidden">
        <Providers>
          <ThemeProvider>
            {children}
          </ThemeProvider>
        </Providers>
      </body>
    </html>
  );
}
