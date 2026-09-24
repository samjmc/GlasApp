import { Redirect, Route, Switch, useLocation } from "wouter";
import { useEffect, type ComponentType } from "react";
import { QueryClientProvider } from "@tanstack/react-query";
import { queryClient } from "./lib/queryClient";
import { AuthProvider, useAuth } from "@/contexts/AuthContext";
import { ThemeProvider } from "@/contexts/ThemeContext";
import { ToastContextProvider } from "@/components/ui/use-toast";
import { Toaster } from "@/components/ui/toaster";
import { ErrorBoundary } from "@/components/ErrorBoundary";
import { OfflineAlert } from "@/components/OfflineAlert";
import { OfflineIndicator } from "@/components/OfflineIndicator";
import { PWAInstallButton } from "@/components/PWAInstallButton";
import CookieConsent from "@/components/CookieConsent";
import { RegionProvider } from "@/contexts/RegionContext";
import { useRegion } from "@/hooks/useRegion";
import { useDailySession } from "@/hooks/useDailySession";
import { AppShell } from "@/components/layout/AppShell";
import { ProtectedRoute } from "@/components/auth/ProtectedRoute";
import { RegionComingSoon } from "@/components/RegionComingSoon";
import { GlasMark } from "@/components/pulse/GlasMark";

import NotFound from "@/pages/not-found";
import HomePage from "@/pages/HomePage";
import TDProfilePage from "@/pages/TDProfilePage";
import PartyProfilePage from "@/pages/PartyProfilePage";
import ResearchedTDsPage from "@/pages/ResearchedTDsPage";
import DebatesPage from "@/pages/DebatesPage";
import ConstituenciesPage from "@/pages/ConstituenciesPage";
import ConstituencyProfilePage from "@/pages/ConstituencyProfilePage";
import QuizPage from "@/pages/QuizPage";
import QuizResultsPage from "@/pages/QuizResultsPage";
import MyPoliticsPage from "@/pages/MyPoliticsPage";
import IdeasPage from "@/pages/IdeasPage";
import DailySessionPage from "@/pages/DailySessionPage";
import ProfilePage from "@/pages/ProfilePage";
import AdminPage from "@/pages/AdminPage";
import ShadowCabinetDashboard from "@/pages/admin/ShadowCabinetDashboard";
import LoginPage from "@/pages/LoginPage";
import RegisterPage from "@/pages/RegisterPage";
import AuthCallbackPage from "@/pages/AuthCallbackPage";
import RegionSelectionPage from "@/pages/RegionSelectionPage";
import PrivacyPolicyPage from "@/pages/PrivacyPolicyPage";
import TermsOfServicePage from "@/pages/TermsOfServicePage";
import ContactPage from "@/pages/ContactPage";

/** Wraps a page so only a signed-in user (or an admin) sees it. */
function guarded(Page: ComponentType, requireAdmin = false) {
  return function GuardedPage() {
    return (
      <ProtectedRoute requireAdmin={requireAdmin}>
        <Page />
      </ProtectedRoute>
    );
  };
}

const DailySession = guarded(DailySessionPage);
const Profile = guarded(ProfilePage);
const Admin = guarded(AdminPage, true);
const AgentMonitor = guarded(ShadowCabinetDashboard, true);

/** Pages a signed-in user has no reason to see send them home. */
function SignedOutOnly({ page: Page }: { page: ComponentType }) {
  const { isAuthenticated } = useAuth();
  return isAuthenticated ? <Redirect to="/" /> : <Page />;
}

function FullScreenLoader() {
  return (
    <div className="flex min-h-[100dvh] items-center justify-center bg-background" role="status" aria-label="Loading">
      <GlasMark className="h-12 w-12 animate-pulse" />
    </div>
  );
}

/** Routes that work in every region. */
const COMMON_ROUTES = (
  <>
    <Route path="/auth/callback" component={AuthCallbackPage} />
    <Route path="/privacy-policy" component={PrivacyPolicyPage} />
    <Route path="/terms-of-service" component={TermsOfServicePage} />
    <Route path="/contact" component={ContactPage} />
    <Route path="/select-region" component={RegionSelectionPage} />
    <Route path="/login">{() => <SignedOutOnly page={LoginPage} />}</Route>
    <Route path="/register">{() => <SignedOutOnly page={RegisterPage} />}</Route>
    <Route path="/daily-session" component={DailySession} />
  </>
);

function IrishRoutes() {
  return (
    <Switch>
      {COMMON_ROUTES}
      <Route path="/" component={HomePage} />
      <Route path="/rankings" component={ResearchedTDsPage} />
      <Route path="/td/:name" component={TDProfilePage} />
      <Route path="/party/:name" component={PartyProfilePage} />
      <Route path="/debates" component={DebatesPage} />
      <Route path="/constituencies" component={ConstituenciesPage} />
      <Route path="/constituency/:name" component={ConstituencyProfilePage} />
      <Route path="/quiz" component={QuizPage} />
      <Route path="/quiz/results" component={QuizResultsPage} />
      <Route path="/my-politics" component={MyPoliticsPage} />
      <Route path="/ideas" component={IdeasPage} />
      <Route path="/profile" component={Profile} />
      <Route path="/admin" component={Admin} />
      <Route path="/admin/shadow" component={AgentMonitor} />
      <Route component={NotFound} />
    </Switch>
  );
}

function USRoutes() {
  return (
    <Switch>
      {COMMON_ROUTES}
      <Route path="/" component={HomePage} />
      <Route>{() => <RegionComingSoon feature="home" headline="US build in progress" />}</Route>
    </Switch>
  );
}

function Router() {
  const { isAuthenticated, isLoading } = useAuth();
  const [location, navigate] = useLocation();
  const { data: dailySession, isLoading: dailyLoading } = useDailySession(isAuthenticated);
  const { status: regionStatus, region } = useRegion();

  const shouldForceDaily =
    isAuthenticated &&
    !dailyLoading &&
    dailySession?.status === "pending" &&
    (dailySession?.items?.length ?? 0) > 0;

  useEffect(() => {
    if (shouldForceDaily && location !== "/daily-session") navigate("/daily-session");
  }, [shouldForceDaily, location, navigate]);

  useEffect(() => {
    if (regionStatus === "needs-selection" && location !== "/select-region") navigate("/select-region");
  }, [regionStatus, location, navigate]);

  if (isLoading || regionStatus === "loading") return <FullScreenLoader />;

  // The daily session and region picker own the whole screen.
  const bare = shouldForceDaily || location === "/daily-session" || location === "/select-region";

  return (
    <AppShell bare={bare}>
      {shouldForceDaily ? <DailySessionPage /> : region?.code === "US" ? <USRoutes /> : <IrishRoutes />}
    </AppShell>
  );
}

function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <ThemeProvider>
        <ErrorBoundary>
          <AuthProvider>
            <RegionProvider>
              <ToastContextProvider>
                <OfflineIndicator />
                <OfflineAlert />
                <Router />
                <PWAInstallButton />
                <CookieConsent />
                <Toaster />
              </ToastContextProvider>
            </RegionProvider>
          </AuthProvider>
        </ErrorBoundary>
      </ThemeProvider>
    </QueryClientProvider>
  );
}

export default App;
