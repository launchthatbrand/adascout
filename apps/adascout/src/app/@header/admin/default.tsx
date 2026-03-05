import { AnimatedThemeToggler, Separator } from "@acme/ui";

import AppHeader from "@acme/ui/layout/AppHeader";

export default function AdminHeaderDefault() {
  return (
    <div className="sticky top-0 z-50 overflow-hidden rounded-t-3xl!">
      <AppHeader
        appName="MintStation"
        sidebarToggle={true}
        showLogo={false}
        className="border-border/40 bg-background/60 p-1! overflow-hidden rounded-t-3xl! shadow-sm backdrop-blur-md"
        rightSlot={
          <div className="flex items-center gap-5">
            <div className="flex items-stretch gap-2">
              {/* <ConnectWalletButton /> */}
              <AnimatedThemeToggler />
            </div>
            <Separator
              orientation="vertical"
              className="mx-2 data-[orientation=vertical]:h-4 bg-border"
            />
            {/* <MintStationNavUser /> */}
          </div>
        }
      />
    </div>
  );
}
