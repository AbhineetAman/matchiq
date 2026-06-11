import { Route, Routes } from "react-router-dom";
import Navbar from "./components/layout/Navbar";
import Footer from "./components/layout/Footer";
import ErrorBoundary from "./components/common/ErrorBoundary";
import EmbedWidget from "./components/widgets/EmbedWidget";
import Home from "./pages/Home";
import Matches from "./pages/Matches";
import Teams from "./pages/Teams";
import TeamSquad from "./pages/TeamSquad";
import Players from "./pages/Players";
import Predictions from "./pages/Predictions";
import Standings from "./pages/Standings";
import Bracket from "./pages/Bracket";

function WidgetPage() {
  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-extrabold text-white">Embeddable Widgets</h1>
        <p className="mt-1 text-sm text-slate-400">
          Drop live FIFA 2026 scores or standings into any article, blog or CMS with one iframe tag.
        </p>
      </div>
      <EmbedWidget />
    </div>
  );
}

function NotFound() {
  return (
    <div className="card mx-auto max-w-md p-10 text-center">
      <div className="text-5xl">🥅</div>
      <h1 className="mt-4 text-xl font-bold text-white">Shot went wide — page not found</h1>
      <a href="/" className="btn-gold mt-6 inline-block">Back to the dashboard</a>
    </div>
  );
}

export default function App() {
  return (
    <div className="flex min-h-screen flex-col">
      <Navbar />
      <main className="mx-auto w-full max-w-7xl flex-1 px-4 py-6 sm:py-8">
        <ErrorBoundary>
          <Routes>
            <Route path="/" element={<Home />} />
            <Route path="/matches" element={<Matches />} />
            <Route path="/standings" element={<Standings />} />
            <Route path="/predictions" element={<Predictions />} />
            <Route path="/players" element={<Players />} />
            <Route path="/teams" element={<Teams />} />
            <Route path="/teams/:teamId" element={<TeamSquad />} />
            <Route path="/bracket" element={<Bracket />} />
            <Route path="/widget" element={<WidgetPage />} />
            <Route path="*" element={<NotFound />} />
          </Routes>
        </ErrorBoundary>
      </main>
      <Footer />
    </div>
  );
}
