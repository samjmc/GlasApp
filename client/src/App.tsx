import { Switch, Route, useLocation } from "wouter";
import { useEffect } from "react";
import { QueryClientProvider } from "@tanstack/react-query";
import { queryClient } from "./lib/queryClient";
import { AuthProvider, useAuth } from "@/contexts/AuthContext";
import { ToastContextProvider } from "@/components/ui/use-toast";
import { Toaster } from "@/components/ui/toaster";
import { ErrorBoundary } from "@/components/ErrorBoundary";
import { OfflineAlert } from "@/components/OfflineAlert";
import { RegionProvider } from "@/contexts/RegionContext";
import { useRegion } from "@/hooks/useRegion";

import NotFound from "@/pages/not-found";
import Header from "./components/Header";
import Footer from "./components/Footer";
import { PWAInstallButton } from "./components/PWAInstallButton";
import { OfflineIndicator } from "./components/OfflineIndicator";
import NewHome from "./pages/NewHome";
import Home from "./pages/Home";
import Results from "./pages/Results";
import HomePage from "@/pages/HomePage";

import ProfilePage from "@/pages/ProfilePage";
import LoginPage from "@/pages/LoginPage";
import RegisterPage from "@/pages/RegisterPage";
import RegisterStepsPage from "@/pages/RegisterStepsPage";
import AuthCallbackPage from "@/pages/AuthCallbackPage";
import EducationPage from "@/pages/EducationPage";
import IdeasPage from "@/pages/IdeasPage";
import ConflictMapPage from "@/pages/ConflictMapPage";
import NotificationsPage from "@/pages/NotificationsPage";
import OfficialElectoralMapPage from "./pages/OfficialElectoralMapPage";
import UserHeatmapPage from "@/pages/UserHeatmapPage";
import ConstituencyComparisonPage from "@/pages/ConstituencyComparisonPage";
import PolicySimulatorPage from "@/pages/PolicySimulatorPage";
import PersonalizedInsightsPage from "@/pages/PersonalizedInsightsPage";
import ConstituencyStatsPage from "@/pages/ConstituencyStatsPage";
import AontuEfficiencyPage from "@/pages/AontuEfficiencyPage";
import LocalRepresentativesPage from "@/pages/LocalRepresentativesPage";
import TDScoresPage from "@/pages/TDScoresPage";
import DebatesPage from "@/pages/DebatesPage";
import MediaWorkspacePage from "@/pages/MediaWorkspacePage";
import TDProfilePage from "@/pages/TDProfilePage";
import PartyProfilePage from "@/pages/PartyProfilePage";
import ConstituenciesPage from "@/pages/ConstituenciesPage";
import ConstituencyProfilePage from "@/pages/ConstituencyProfilePage";
import ResearchedTDsPage from "@/pages/ResearchedTDsPage";
import TDLeaderboardPage from "@/pages/TDLeaderboardPage";
import PollingSystemInfo from "@/pages/PollingSystemInfo";
import PollingDashboard from "@/pages/PollingDashboard";
import AdminPollingEntry from "@/pages/AdminPollingEntry";
import ShadowCabinetDashboard from "@/pages/admin/ShadowCabinetDashboard";
import MyPoliticsPage from "@/pages/MyPoliticsPage";
import AskTDPage from "@/pages/AskTDPage";

import EnhancedQuizPage from "@/pages/EnhancedQuizPage";
import EnhancedResultsPage from "@/pages/EnhancedResultsPage";
import DimensionWeightsPage from "@/pages/DimensionWeightsPage";
import TestAnswerExplainerPage from "@/pages/TestAnswerExplainerPage";
import AdminPage from "@/pages/AdminPage";
import PrivacyPolicyPage from "@/pages/PrivacyPolicyPage";
import TermsOfServicePage from "@/pages/TermsOfServicePage";
import ContactPage from "@/pages/ContactPage";
import BottomNavigation from "@/components/BottomNavigation";
import CookieConsent from "@/components/CookieConsent";
import { QuizProvider } from "@/contexts/QuizContextNew";
import { MultidimensionalQuizProvider } from "@/contexts/MultidimensionalQuizContext";
import DailySessionPage from "@/pages/DailySessionPage";
import { useDailySession } from "@/hooks/useDailySession";
import RegionSelectionPage from "@/pages/RegionSelectionPage";
import { RegionComingSoon } from "@/components/RegionComingSoon";

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
    if (shouldForceDaily && location !== "/daily-session") {
      navigate("/daily-session");
    }
  }, [shouldForceDaily, location, navigate]);

  useEffect(() => {
    if (regionStatus === "needs-selection" && location !== "/select-region") {
      navigate("/select-region");
    }
  }, [regionStatus, location, navigate]);

  if (isLoading || regionStatus === "loading") {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="text-lg">Loading...</div>
      </div>
    );
  }

  if (shouldForceDaily) {
    return (
      <Switch>
        <Route path="/daily-session" component={DailySessionPage} />
        <Route>
          {() => <DailySessionPage />}
        </Route>
      </Switch>
    );
  }

  const renderUSRoutes = () => {
    if (!isAuthenticated) {
      return (
        <Switch>
          <Route path="/auth/callback" component={AuthCallbackPage} />
          <Route path="/privacy-policy" component={PrivacyPolicyPage} />
          <Route path="/terms-of-service" component={TermsOfServicePage} />
          <Route path="/contact" component={ContactPage} />
          <Route path="/select-region" component={RegionSelectionPage} />
          <Route path="/register" component={RegisterPage} />
          <Route path="/register-steps" component={RegisterStepsPage} />
          <Route path="/login" component={LoginPage} />
          <Route path="/" component={HomePage} />
          <Route>
            {() => (
              <RegionComingSoon
                feature="home"
                headline="US build in progress"
              />
            )}
          </Route>
        </Switch>
      );
    }

    return (
      <Switch>
        <Route path="/auth/callback" component={AuthCallbackPage} />
        <Route path="/privacy-policy" component={PrivacyPolicyPage} />
        <Route path="/terms-of-service" component={TermsOfServicePage} />
        <Route path="/contact" component={ContactPage} />
        <Route path="/select-region" component={RegionSelectionPage} />
        <Route path="/daily-session" component={DailySessionPage} />
        <Route path="/" component={HomePage} />
        <Route>
          {() => (
            <RegionComingSoon
              feature="home"
              headline="US build in progress"
            />
          )}
        </Route>
      </Switch>
    );
  };

  const renderIrishRoutes = () => (
    <Switch>
      {/* Auth callback route - always accessible */}
      <Route path="/auth/callback" component={AuthCallbackPage} />
      
      {/* Legal & region selection pages - always accessible (no auth required) */}
      <Route path="/privacy-policy" component={PrivacyPolicyPage} />
      <Route path="/terms-of-service" component={TermsOfServicePage} />
      <Route path="/contact" component={ContactPage} />
      <Route path="/select-region" component={RegionSelectionPage} />
      
      {!isAuthenticated ? (
        <>
          {/* Public routes - no authentication required */}
          <Route path="/" component={HomePage} />
          <Route path="/td/:name" component={TDProfilePage} />
          <Route path="/party/:name" component={PartyProfilePage} />
          <Route path="/debates" component={DebatesPage} />
          <Route path="/debates/workspace" component={MediaWorkspacePage} />
          <Route path="/ask-td" component={AskTDPage} />
          <Route path="/td-leaderboard">
            {() => {
              window.location.href = "/?tab=tds";
              return <div>Redirecting to Rankings...</div>;
            }}
          </Route>
          <Route path="/polling">
            {() => {
              window.location.href = "/?tab=tds";
              return <div>Redirecting to Rankings...</div>;
            }}
          </Route>
          <Route path="/login" component={LoginPage} />
          <Route path="/register" component={RegisterPage} />
          
          {/* Quiz routes available for all users */}
          <Route path="/enhanced-quiz" component={EnhancedQuizPage} />
          <Route path="/enhanced-results" component={EnhancedResultsPage} />
          <Route path="/dimension-weights" component={DimensionWeightsPage} />
        </>
      ) : (
        <>
          {/* Protected routes - authentication required */}
          <Route path="/" component={HomePage} />
          <Route path="/daily-session" component={DailySessionPage} />
          <Route path="/conflicts" component={ConflictMapPage} />
          <Route path="/profile" component={ProfilePage} />
          <Route path="/ideas" component={IdeasPage} />
          
          {/* Redirects for legacy pages */}
          <Route path="/education">
            {() => {
              window.location.href = "/";
              return <div>Redirecting to Home...</div>;
            }}
          </Route>
          <Route path="/admin" component={AdminPage} />
          <Route path="/admin/shadow" component={ShadowCabinetDashboard} />
          <Route path="/notifications" component={NotificationsPage} />
          
          {/* Enhanced Quiz Routes */}
          <Route path="/enhanced-quiz" component={EnhancedQuizPage} />
          <Route path="/dimension-weights" component={DimensionWeightsPage} />
          <Route path="/enhanced-results" component={EnhancedResultsPage} />
          <Route path="/test-answer-explainer" component={TestAnswerExplainerPage} />
          
          {/* Map views */}
          <Route path="/electoral-map" component={OfficialElectoralMapPage} />
          <Route path="/user-heatmap" component={UserHeatmapPage} />
          <Route path="/constituency-comparison" component={ConstituencyComparisonPage} />
          <Route path="/policy-simulator" component={PolicySimulatorPage} />
          <Route path="/personalized-insights" component={PersonalizedInsightsPage} />
          <Route path="/constituency-stats" component={ConstituencyStatsPage} />
          <Route path="/aontu-efficiency" component={AontuEfficiencyPage} />
          <Route path="/local-representatives" component={LocalRepresentativesPage} />
          <Route path="/my-tds" component={LocalRepresentativesPage} />
          <Route path="/td-scores" component={TDScoresPage} />
          <Route path="/td-leaderboard">
            {() => {
              window.location.href = "/?tab=tds";
              return <div>Redirecting to Rankings...</div>;
            }}
          </Route>
          <Route path="/debates" component={DebatesPage} />
          <Route path="/debates/workspace" component={MediaWorkspacePage} />
          <Route path="/ask-td" component={AskTDPage} />
          <Route path="/researched-tds" component={ResearchedTDsPage} />
          <Route path="/my-politics" component={MyPoliticsPage} />
          <Route path="/td/:name" component={TDProfilePage} />
          <Route path="/party/:name" component={PartyProfilePage} />
          <Route path="/constituencies" component={ConstituenciesPage} />
          <Route path="/constituency/:name" component={ConstituencyProfilePage} />
          
          {/* Polling System Routes - now accessible via homepage Rankings tab */}
          <Route path="/polling">
            {() => {
              window.location.href = "/?tab=tds";
              return <div>Redirecting to Rankings...</div>;
            }}
          </Route>
          <Route path="/polling/info" component={PollingSystemInfo} />
          <Route path="/admin/polling/entry" component={AdminPollingEntry} />
          
          {/* Auth routes redirect to home when logged in */}
          <Route path="/login" component={HomePage} />
          <Route path="/register" component={HomePage} />
          
          {/* Results routes */}
          <Route path="/results">
            {() => (
              <QuizProvider>
                <Results />
              </QuizProvider>
            )}
          </Route>
          <Route path="/results/:shareCode">
            {() => (
              <QuizProvider>
                <Results />
              </QuizProvider>
            )}
          </Route>
          
          {/* Legacy pages */}
          <Route path="/classic-home" component={NewHome} />
          <Route path="/old-home" component={Home} />
        </>
      )}
      <Route component={NotFound} />
    </Switch>
  );

  if (region?.code === "US") {
    return renderUSRoutes();
  }

  return renderIrishRoutes();
}

function App() {
  const [location] = useLocation();
  const isDailySessionRoute = location === "/daily-session";
  const isEnhancedQuizRoute = location === "/enhanced-quiz";

  const mainClass = isDailySessionRoute ? "flex-grow overflow-x-hidden" : "mobile-shell flex-grow overflow-x-hidden";
  
  // Don't apply background on Enhanced Quiz page - it has its own black background
  const containerClasses = isEnhancedQuizRoute
    ? "flex min-h-screen flex-col text-gray-900 transition-colors duration-200 dark:text-white overflow-x-hidden"
    : "flex min-h-screen flex-col bg-gray-50 text-gray-900 transition-colors duration-200 dark:bg-gray-900 dark:text-white overflow-x-hidden";

  return (
    <ErrorBoundary>
      <QueryClientProvider client={queryClient}>
        <AuthProvider>
          <RegionProvider>
            <ToastContextProvider>
              <MultidimensionalQuizProvider>
                <div className={containerClasses}>
                  {!isDailySessionRoute && (
                    <>
                      <OfflineIndicator />
                      <OfflineAlert />
                      <Header />
                    </>
                  )}
                  <main className={mainClass}>
                    <Router />
                  </main>
                  {!isDailySessionRoute && (
                    <>
                      <Footer className="hidden md:block" />
                      <BottomNavigation />
                      <PWAInstallButton />
                      <CookieConsent />
                    </>
                  )}
                  <Toaster />
                </div>
              </MultidimensionalQuizProvider>
            </ToastContextProvider>
          </RegionProvider>
        </AuthProvider>
      </QueryClientProvider>
    </ErrorBoundary>
  );
}

export default App;
