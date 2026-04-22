import type { Metadata, Viewport } from "next";
import type { ReactNode } from "react";

import { APP_NAME } from "@/lib/app-config";

import "./globals.css";

export const metadata: Metadata = {
  title: APP_NAME,
  description: "A tiny shared calendar for tracking Mewing.",
};

export const viewport: Viewport = {
  themeColor: "#eef6f2",
  width: "device-width",
  initialScale: 1,
};

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
