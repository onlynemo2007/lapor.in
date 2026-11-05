import { AppProvider } from "./lib/store";
import Shell, { useRoute } from "./components/Shell";
import { ToastProvider } from "./components/ui";
import DashboardView from "./views/DashboardView";
import IsiView from "./views/IsiView";
import PresensiView from "./views/PresensiView";
import PratinjauView from "./views/PratinjauView";
import SinkronView from "./views/SinkronView";

function Router() {
  const { view, params } = useRoute();
  return (
    <Shell view={view}>
      {view === "dashboard" && <DashboardView />}
      {view === "isi" && <IsiView params={params} />}
      {view === "presensi" && <PresensiView />}
      {view === "pratinjau" && <PratinjauView />}
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
