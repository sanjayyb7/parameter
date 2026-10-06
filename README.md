# Parameter: Infrastructure

React + Vite + TypeScript + Tailwind v4 build of the Infrastructure section from the Wonder designs
(`01 Connections Tab - Empty`, `02 Resources Tab - Empty`, `03 Resources Tab - Connected`).

```bash
npm install
npm run dev
```

## What's here

| File | Purpose |
|---|---|
| `src/App.tsx` | Page, tab state, connect dialog wiring |
| `src/components/Shell.tsx` | Sidebar, breadcrumb top bar |
| `src/components/Tabs.tsx` | Connections / Resources / Exposure / Attack paths tabs (faded until data exists) |
| `src/components/Table.tsx` | Toolbar, header row with grid-joint dots, skeleton rows, grid pattern |
| `src/components/ConnectionsTab.tsx` | Empty state with grid pattern; populated connections table with sync progress |
| `src/components/ResourcesTab.tsx` | Skeleton empty state; populated resources table with quick filters |
| `src/components/ConnectModal.tsx` | Provider picker (read-only messaging, "inventory soon" for DO/Render) |
| `src/data/useInfrastructure.ts` | Mock store: connect → syncing progress → resources published |

The data layer is mocked. Swap `useInfrastructure` for real API calls (e.g. TanStack Query) without touching the UI.

## Flow

1. Nothing connected → Connections tab shows the grid-pattern empty state; other tabs are faded.
2. Connect cloud → provider dialog → a connection appears with a live "Syncing n%" status.
3. Sync completes → Resources, Exposure and Attack paths unlock with counts.
