/*
 * OpenMeet - Open-source, self-hostable video meeting platform
 * Copyright (C) 2026 OpenMeet Contributors
 * SPDX-License-Identifier: AGPL-3.0-or-later
 */
import "./globals.css";

export const metadata = {
  title: "OpenMeet - Video Meetings & Screen Sharing",
  description: "Lightweight, instant, peer-to-peer video meetings and screen sharing.",
  icons: {
    icon: "/favicon.ico",
  },
};

export default function RootLayout({ children }) {
  return (
    <html lang="en" className="dark h-full w-full">
      <body className="h-screen w-screen overflow-hidden bg-[#0b0d13] text-slate-100 antialiased select-none">
        {children}
      </body>
    </html>
  );
}
