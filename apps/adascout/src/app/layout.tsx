import "./styles.css";

import type { Metadata } from "next";
import { ConvexAuthNextjsServerProvider } from "@convex-dev/auth/nextjs/server";
import StandardLayout from "@acme/ui/layout/StandardLayout";
import { ThemeProvider } from "@acme/ui/theme";
import { Toaster } from "@acme/ui/toast";
import { Geist } from "next/font/google";
import { headers } from "next/headers";
import { cn } from "@acme/ui";
import { Providers } from "./providers";

export const metadata: Metadata = {
  title: "ADA Scount",
  description: "ADA Scount scans websites and PDF files for WCAG 2.2 AA issues and remediation guidance.",
  icons: [{ rel: "icon", url: "/favicon.ico" }],
};

const geist = Geist({
  subsets: ["latin"],
  variable: "--font-geist-sans",
});

export default async function RootLayout({
  sidebar,
  header,
  footer,
  children,
}: Readonly<{
  children: React.ReactNode;
  sidebar: React.ReactNode;
  header: React.ReactNode;
  footer: React.ReactNode;
}>) {
  const headerList = await headers();
  const pathnameHeader = headerList.get("x-pathname");
  const pathname =
    typeof pathnameHeader === "string" && pathnameHeader.length > 0 ? pathnameHeader : "/";
  const hasPathnameHeader = Boolean(pathnameHeader && pathnameHeader.length > 0);

  const segments = pathname
    .replace(/^\/+/, "")
    .split("/")
    .map((segment) => segment.trim())
    .filter(Boolean);
  const firstSegment = segments[0] ?? "";

  const fallbackShowSidebar = sidebar !== null;
  const fallbackShowHeader = header !== null;

  let showHeader = fallbackShowHeader;
  let showSidebar = fallbackShowSidebar;
  if (hasPathnameHeader) {
    showHeader = true;
    showSidebar = firstSegment === "admin";
    if (firstSegment === "sign-in" || firstSegment === "sign-up") {
      showHeader = false;
      showSidebar = false;
    }
  }

  return (
    <html lang="en" className={`${geist.variable}`}>
      <body className="min-h-screen">
        {await ConvexAuthNextjsServerProvider({
          children: (
            <Providers>
              <ThemeProvider>
                <StandardLayout
                  appName="ADA Scount"
                  sidebar={showSidebar ? sidebar : undefined}
                  header={showHeader ? header : null}
                  footer={footer}
                  showSidebar={showSidebar}
                  className={cn(
                    showSidebar
                      ? "shadow-[-12px_0_10px_-3px_rgba(0,0,0,0.3)] max-h-screen rounded-3xl!"
                      : "max-h-screen",
                  )}
                  sidebarDefaultOpen
                  sidebarWidth="16em"
                >
                  <div className="flex min-h-0 flex-1">{children}</div>
                </StandardLayout>
                <Toaster />
              </ThemeProvider>
            </Providers>
          ),
        })}
      </body>
    </html>
  );
}
