import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Infobip Monitor Pro",
  description: "Dashboard premium de monitoramento Infobip",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="pt-BR">
      <body style={{ margin: 0 }}>{children}</body>
    </html>
  );
}