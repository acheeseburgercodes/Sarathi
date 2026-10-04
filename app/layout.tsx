import type { Metadata } from "next";
import "leaflet/dist/leaflet.css";
import "./portal.css";

export const metadata: Metadata = {
  title: "Sarathi · Crisis Intelligence Network",
  description: "A multi-agent intelligence, situation reporting, public assistance, and early warning platform for disaster response.",
  icons: {
    icon: "/favicon.svg",
    shortcut: "/favicon.svg",
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en-IN">
      <body className="antialiased">{children}</body>
    </html>
  );
}
