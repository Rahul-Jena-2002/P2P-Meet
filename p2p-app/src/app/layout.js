/*
 * OpenMeet - Open-source, self-hostable video meeting platform
 * Copyright (C) 2026 OpenMeet Contributors
 * SPDX-License-Identifier: AGPL-3.0-or-later
 */
import "./globals.css";

export const metadata = {
  title: "p2pmeet - Direct Peer-to-Peer Encrypted Video Meetings & File Sharing",
  description: "Instant decentralized, privacy-first video meetings, direct P2P file sharing, synchronized co-streaming, and interactive remote control with zero server intermediaries.",
  icons: {
    icon: "/favicon.svg",
    shortcut: "/favicon.svg",
    apple: "/favicon.svg"
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
