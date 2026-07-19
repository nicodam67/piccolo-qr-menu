"use client";

import { useState } from "react";

import { Sidebar } from "./sidebar";
import { Topbar } from "./topbar";

type AdminLayoutProps = {
  restaurantName: string;
  locale: string;
  databaseStatus: "connected";
  children: React.ReactNode;
};

export function AdminLayout({
  restaurantName,
  locale,
  databaseStatus,
  children,
}: AdminLayoutProps) {
  const [mobileSidebarOpen, setMobileSidebarOpen] = useState(false);
  const [tabletSidebarCollapsed, setTabletSidebarCollapsed] = useState(true);

  return (
    <div className="min-h-screen bg-[#f6f4ef]">
      <Sidebar
        collapsed={tabletSidebarCollapsed}
        mobileOpen={mobileSidebarOpen}
        onMobileClose={() => setMobileSidebarOpen(false)}
      />

      <div
        className={`min-h-screen transition-[padding] duration-200 ${
          tabletSidebarCollapsed ? "md:pl-20" : "md:pl-64"
        } lg:pl-64`}
      >
        <Topbar
          restaurantName={restaurantName}
          locale={locale}
          databaseStatus={databaseStatus}
          sidebarCollapsed={tabletSidebarCollapsed}
          onMobileMenuOpen={() => setMobileSidebarOpen(true)}
          onTabletSidebarToggle={() =>
            setTabletSidebarCollapsed((collapsed) => !collapsed)
          }
        />
        <main>{children}</main>
      </div>
    </div>
  );
}
