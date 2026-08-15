import { Toaster } from "sonner"
import { useStore } from "./lib/store"
import { useLiveTick, useOverview, usePins, usePortsStream } from "./lib/hooks"
import { Sidebar } from "./components/layout/Sidebar"
import { TopBar } from "./components/layout/TopBar"
import { OverviewPage } from "./components/overview/OverviewPage"
import { PortsPage } from "./components/table/PortsTable"
import { PinnedPage } from "./components/pinned/PinnedPage"
import { DetailDrawer } from "./components/drawer/DetailDrawer"
import { KillModal } from "./components/drawer/KillModal"
import { CommandPalette } from "./components/palette/CommandPalette"

function DownBanner() {
  const serverUp = useStore((s) => s.serverUp)
  const retry = useStore((s) => s.retry)
  if (serverUp) return null
  return (
    <div className="down-banner-wrap">
      <div className="banner banner--down" role="alert">
        <span className="status-dot status-dot--danger" />
        <span>Backend unreachable — retrying</span>
        <button
          type="button"
          className="banner-action btn btn--ghost btn--small"
          onClick={retry}
        >
          Retry now
        </button>
      </div>
    </div>
  )
}

export default function App() {
  const view = useStore((s) => s.view)

  useLiveTick()
  usePortsStream()
  useOverview()
  usePins()

  return (
    <div className="app">
      <Sidebar />
      <div className="app-main">
        <TopBar />
        <main className="app-content">
          <DownBanner />
          {view === "overview" && <OverviewPage />}
          {view === "ports" && <PortsPage />}
          {view === "pinned" && <PinnedPage />}
        </main>
      </div>
      <DetailDrawer />
      <KillModal />
      <CommandPalette />
      <Toaster
        theme="dark"
        position="bottom-right"
        toastOptions={{
          style: {
            background: "var(--bg-surface-3)",
            border: "1px solid var(--hairline-strong)",
            color: "var(--text-1)",
            borderRadius: "var(--r-drawer)",
            fontSize: "var(--fs-13)",
            boxShadow: "var(--shadow-pop)",
          },
        }}
      />
    </div>
  )
}