/*
 * OpenMeet - Open-source, self-hostable video meeting platform
 * Copyright (C) 2026 OpenMeet Contributors
 * SPDX-License-Identifier: AGPL-3.0-or-later
 */
import "./globals.css";

export const metadata = {
  title: "p2pmeet",
  description: "Instant peer-to-peer video meetings, co-streaming, and remote screen sharing.",
  icons: {
    icon: "/favicon.ico",
  },
};

export default function RootLayout({ children }) {
  return (
    <html lang="en" className="dark h-full w-full">
      <body className="h-screen w-screen overflow-hidden bg-[#1C1C1C] text-[#F5E8D8] antialiased select-none">
        {children}
      </body>
    </html>
  );
}
