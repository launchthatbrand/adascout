import { SidebarInset, SidebarProvider } from "../sidebar";

import AppHeader from "./AppHeader";
import { AppSidebar } from "./app-sidebar";
import { SidebarHoverWrapper } from "./SidebarHoverWrapper";
// import { AppSidebar } from "./AppSidebar";
import { cn } from "../lib/utils";

// import { AppSidebar } from "./AppSidebar";

export default function StandardLayout(props: {
  children?: React.ReactNode;
  sidebar?: React.ReactNode;
  appName: string;
  topbar?: React.ReactNode;
  className?: string;
  header?: React.ReactNode;
  footer?: React.ReactNode;
  showSidebar?: boolean;
  headerRightSlot?: React.ReactNode;
  bgComponent?: React.ReactNode;
  sidebarOpenOnHover?: boolean;
  /**
   * Controls whether the sidebar starts open on first paint (desktop).
   * Defaults to true to preserve existing behavior.
   */
  sidebarDefaultOpen?: boolean;
  /**
   * Overrides the collapsed (icon) sidebar width, e.g. "4rem".
   * This maps to the `--sidebar-width-icon` CSS variable in `@acme/ui/sidebar`.
   */
  sidebarWidthIcon?: string;
  /**
   * Overrides the expanded desktop sidebar width, e.g. "18rem".
   * This maps to the `--sidebar-width` CSS variable in `@acme/ui/sidebar`.
   */
  sidebarWidth?: string;
}) {
  const sidebarToggle = props.sidebar !== undefined;
  // If showSidebar is explicitly set to false, hide the sidebar
  // Otherwise, show it if it exists
  const shouldShowSidebar = props.showSidebar !== false && sidebarToggle;

  const sidebarProviderStyle =
    (typeof props.sidebarWidthIcon === "string" && props.sidebarWidthIcon.length > 0) ||
    (typeof props.sidebarWidth === "string" && props.sidebarWidth.length > 0)
      ? ({
          ...(typeof props.sidebarWidthIcon === "string" && props.sidebarWidthIcon.length > 0
            ? { "--sidebar-width-icon": props.sidebarWidthIcon }
            : {}),
          ...(typeof props.sidebarWidth === "string" && props.sidebarWidth.length > 0
            ? { "--sidebar-width": props.sidebarWidth }
            : {}),
        } as React.CSSProperties)
      : undefined;

  return (
    <SidebarProvider
      defaultOpen={props.sidebarDefaultOpen ?? true}
      style={sidebarProviderStyle}
    >
      {shouldShowSidebar ? (
        <SidebarHoverWrapper enabled={props.sidebarOpenOnHover === true}>
          {props.sidebar}
        </SidebarHoverWrapper>
      ) : null}
      {/* <AppSidebar sidebar={props.sidebar} /> */}
      <SidebarInset
        className={cn(
          "min-h-full z-50 max-h-[calc(100vh-15px)]! overflow-hidden isolate",
          props.className,
        )}
      >
        <div
          id="lt-layout-scroll-container"
          data-layout-scroll-container
          className="h-full overflow-y-auto flex flex-col"
        >
          {props.bgComponent !== undefined ? props.bgComponent : null}
          {props.header !== undefined ? (
            props.header
          ) : (
            <AppHeader
              appName={props.appName}
              sidebarToggle={shouldShowSidebar}
              className="bg-background sticky top-0 z-50"
              rightSlot={props.headerRightSlot}
            />
          )}
          {/* <div className="relative w-full max-w-full overflow-x-hidden"> */}
          <div className="min-h-0 flex flex-col flex-1">
            {props.children}
            {props.footer}
          </div>
        </div>
        {/* <div className="pointer-events-none absolute inset-x-0 bottom-0 z-20 h-10 bg-linear-to-b from-transparent to-background" /> */}
      </SidebarInset>
    </SidebarProvider>
  );
}
