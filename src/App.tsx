import { AppProvider } from "./lib/store";
import Shell, { useRoute } from "./components/Shell";
import { ToastProvider } from "./components/ui";
import DashboardView from "./views/DashboardView";
import IsiView from "./views/IsiView";
import PresensiView from "./views/PresensiView";
import KeuanganView from "./views/KeuanganView";
import PratinjauView from "./views/PratinjauView";
import SinkronView from "./views/SinkronView";
import LandingView from "./views/LandingView";
import { VIEW_AWAL } from "./lib/rute";

function Router() {
  const { view, params } = useRoute();
  // Alamat utama (…/) = halaman pilih: tanpa sidebar, tanpa bilah menu.
  if (view === VIEW_AWAL) return <LandingView />;
  return (
    <Shell view={view}>
      {view === "dashboard" && <DashboardView />}
      {view === "isi" && <IsiView params={params} />}
      {view === "presensi" && <PresensiView />}
      {view === "keuangan" && <KeuanganView />}
      {view === "pratinjau" && <PratinjauView params={params} />}
      {view === "sinkron" && <SinkronView params={params} />}
    </Shell>
  );
}

export default function App() {
  return (
    <ToastProvider>
      <AppProvider>
        <Router />
      </AppProvider>
    </ToastProvider>
  );
}
