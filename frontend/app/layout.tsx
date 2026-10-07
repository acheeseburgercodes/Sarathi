import type { Metadata, Viewport } from "next";
import "leaflet/dist/leaflet.css";
import "./portal.css";
import { AuthProvider } from "@/components/auth-provider";

export const metadata: Metadata = {
  title: "Sarathi · Crisis Intelligence Network",
  description: "A multi-agent intelligence, situation reporting, public assistance, and early warning platform for disaster response.",
  icons: {
    icon: "/favicon.svg",
    shortcut: "/favicon.svg",
  },
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  maximumScale: 5,
  viewportFit: "cover",
  themeColor: "#000000",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en-IN">
      <body className="antialiased"><AuthProvider>{children}</AuthProvider></body>
    </html>
  );
}
