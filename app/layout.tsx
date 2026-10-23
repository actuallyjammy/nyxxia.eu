import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Jammy · Projectes i experiments",
  description: "L’espai personal d’en Jammy, des de Barcelona. Projectes, simuladors electorals i experiments.",
  icons: {
    icon: 'favicon.ico'
  },
};



export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="ca">
      <body>{children}</body>
    </html>
  );
}
