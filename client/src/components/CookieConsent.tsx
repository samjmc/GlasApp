import { useState, useEffect } from "react";
import { Link } from "wouter";
import { Cookie, X, Settings, CheckCircle, XCircle } from "lucide-react";

interface CookiePreferences {
  essential: boolean;
  analytics: boolean;
  functional: boolean;
}

export default function CookieConsent() {
  const [isVisible, setIsVisible] = useState(false);
  const [showSettings, setShowSettings] = useState(false);
  const [preferences, setPreferences] = useState<CookiePreferences>({
    essential: true, // Always true (required)
    analytics: false,
    functional: false,
  });

  useEffect(() => {
    // Check if user has already made a choice
    const consent = localStorage.getItem('cookie_consent');
    if (!consent) {
      // Show banner after a short delay for better UX
      setTimeout(() => setIsVisible(true), 1000);
    } else {
      // Load saved preferences
      try {
        const saved = JSON.parse(consent);
        setPreferences(saved);
        // Initialize analytics if consented
        if (saved.analytics) {
          initializeAnalytics();
        }
      } catch (e) {
        console.error('Failed to parse cookie preferences:', e);
      }
    }
  }, []);

  const initializeAnalytics = () => {
    // Initialize Google Analytics or other analytics services
    // Only call this if user has consented
    console.log('Analytics initialized');
    // TODO: Add actual analytics initialization code when ready
    // Example: gtag('config', 'G-XXXXXXXXXX');
  };

  const handleAcceptAll = () => {
    const allAccepted: CookiePreferences = {
      essential: true,
      analytics: true,
      functional: true,
    };
    savePreferences(allAccepted);
    initializeAnalytics();
    setIsVisible(false);
  };

  const handleRejectAll = () => {
    const onlyEssential: CookiePreferences = {
      essential: true,
      analytics: false,
      functional: false,
    };
    savePreferences(onlyEssential);
    setIsVisible(false);
  };

  const handleSavePreferences = () => {
    savePreferences(preferences);
    if (preferences.analytics) {
      initializeAnalytics();
    }
    setIsVisible(false);
  };

  const savePreferences = (prefs: CookiePreferences) => {
    localStorage.setItem('cookie_consent', JSON.stringify(prefs));
    localStorage.setItem('cookie_consent_date', new Date().toISOString());
    
    // Set cookie preferences for backend (if needed)
    document.cookie = `cookie_analytics=${prefs.analytics ? '1' : '0'}; path=/; max-age=31536000; SameSite=Lax`;
    document.cookie = `cookie_functional=${prefs.functional ? '1' : '0'}; path=/; max-age=31536000; SameSite=Lax`;
  };

  const togglePreference = (key: keyof CookiePreferences) => {
    if (key === 'essential') return; // Can't disable essential cookies
    setPreferences(prev => ({
      ...prev,
      [key]: !prev[key],
    }));
  };

  if (!isVisible) return null;

  return (
    <>
      {/* Backdrop */}
      <div className="fixed inset-0 bg-black/50 z-40 backdrop-blur-sm" />

      {/* Cookie Banner */}
      <div className="fixed bottom-0 left-0 right-0 z-50 p-4 md:p-6 pointer-events-none">
        <div className="max-w-6xl mx-auto pointer-events-auto">
          <div className="bg-white dark:bg-gray-800 rounded-lg shadow-2xl border border-gray-200 dark:border-gray-700 overflow-hidden">
            {/* Header */}
            <div className="bg-gradient-to-r from-blue-500 to-purple-600 p-4 flex items-center justify-between">
              <div className="flex items-center gap-3">
                <Cookie className="w-6 h-6 text-white" />
                <h2 className="text-xl font-bold text-white">
                  Cookie Preferences
                </h2>
              </div>
              <button
                onClick={() => setIsVisible(false)}
                className="text-white hover:bg-white/20 p-2 rounded-lg transition-colors"
                aria-label="Close"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Content */}
            <div className="p-6">
              {!showSettings ? (
                // Simple View
                <div>
                  <p className="text-gray-700 dark:text-gray-300 mb-4 text-sm md:text-base">
                    We use cookies to provide essential functionality, improve your experience, and analyze usage.
                    By clicking "Accept All," you consent to our use of cookies.
                  </p>
                  <p className="text-gray-600 dark:text-gray-400 text-xs md:text-sm mb-4">
                    Read our{" "}
                    <Link href="/privacy-policy" className="text-blue-600 dark:text-blue-400 hover:underline font-medium">
                      Privacy Policy
                    </Link>{" "}
                    and{" "}
                    <Link href="/terms-of-service" className="text-blue-600 dark:text-blue-400 hover:underline font-medium">
                      Terms of Service
                    </Link>{" "}
                    for more information.
                  </p>

                  {/* Buttons */}
                  <div className="flex flex-col md:flex-row gap-3">
                    <button
                      onClick={handleAcceptAll}
                      className="flex-1 bg-gradient-to-r from-blue-500 to-purple-600 hover:from-blue-600 hover:to-purple-700 text-white px-6 py-3 rounded-lg font-semibold transition-all transform hover:scale-105 flex items-center justify-center gap-2"
                    >
                      <CheckCircle className="w-5 h-5" />
                      Accept All
                    </button>
                    <button
                      onClick={handleRejectAll}
                      className="flex-1 bg-gray-200 dark:bg-gray-700 hover:bg-gray-300 dark:hover:bg-gray-600 text-gray-900 dark:text-white px-6 py-3 rounded-lg font-semibold transition-colors flex items-center justify-center gap-2"
                    >
                      <XCircle className="w-5 h-5" />
                      Reject All
                    </button>
                    <button
                      onClick={() => setShowSettings(true)}
                      className="flex-1 border-2 border-blue-500 dark:border-blue-400 text-blue-600 dark:text-blue-400 hover:bg-blue-50 dark:hover:bg-blue-900/20 px-6 py-3 rounded-lg font-semibold transition-colors flex items-center justify-center gap-2"
                    >
                      <Settings className="w-5 h-5" />
                      Customize
                    </button>
                  </div>
                </div>
              ) : (
                // Detailed Settings View
                <div>
                  <p className="text-gray-700 dark:text-gray-300 mb-6 text-sm">
                    Choose which cookies you'd like to allow. Essential cookies are required for the site to function.
                  </p>

                  {/* Cookie Categories */}
                  <div className="space-y-4 mb-6">
                    {/* Essential Cookies */}
                    <div className="border border-gray-300 dark:border-gray-600 rounded-lg p-4 bg-gray-50 dark:bg-gray-700/50">
                      <div className="flex items-start justify-between mb-2">
                        <div className="flex-1">
                          <div className="flex items-center gap-2 mb-1">
                            <h3 className="font-semibold text-gray-900 dark:text-white">
                              Essential Cookies
                            </h3>
                            <span className="text-xs bg-red-100 dark:bg-red-900/30 text-red-700 dark:text-red-400 px-2 py-0.5 rounded-full font-medium">
                              Required
                            </span>
                          </div>
                          <p className="text-xs text-gray-600 dark:text-gray-400">
                            Required for authentication, security, and basic site functionality. Cannot be disabled.
                          </p>
                        </div>
                        <div className="ml-4">
                          <div className="w-12 h-6 bg-blue-500 rounded-full flex items-center justify-end px-1 cursor-not-allowed opacity-50">
                            <div className="w-5 h-5 bg-white rounded-full" />
                          </div>
                        </div>
                      </div>
                      <p className="text-xs text-gray-500 dark:text-gray-500 mt-2">
                        Examples: Authentication tokens, session management, CSRF protection
                      </p>
                    </div>

                    {/* Analytics Cookies */}
                    <div className="border border-gray-300 dark:border-gray-600 rounded-lg p-4 bg-white dark:bg-gray-700/30">
                      <div className="flex items-start justify-between mb-2">
                        <div className="flex-1">
                          <div className="flex items-center gap-2 mb-1">
                            <h3 className="font-semibold text-gray-900 dark:text-white">
                              Analytics Cookies
                            </h3>
                            <span className="text-xs bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-400 px-2 py-0.5 rounded-full font-medium">
                              Optional
                            </span>
                          </div>
                          <p className="text-xs text-gray-600 dark:text-gray-400">
                            Help us understand how you use the platform so we can improve it. All data is anonymized.
                          </p>
                        </div>
                        <div className="ml-4">
                          <button
                            onClick={() => togglePreference('analytics')}
                            className={`w-12 h-6 rounded-full flex items-center transition-colors ${
                              preferences.analytics
                                ? 'bg-blue-500 justify-end'
                                : 'bg-gray-300 dark:bg-gray-600 justify-start'
                            } px-1`}
                          >
                            <div className="w-5 h-5 bg-white rounded-full" />
                          </button>
                        </div>
                      </div>
                      <p className="text-xs text-gray-500 dark:text-gray-500 mt-2">
                        Examples: Page views, feature usage, error tracking (anonymized)
                      </p>
                    </div>

                    {/* Functional Cookies */}
                    <div className="border border-gray-300 dark:border-gray-600 rounded-lg p-4 bg-white dark:bg-gray-700/30">
                      <div className="flex items-start justify-between mb-2">
                        <div className="flex-1">
                          <div className="flex items-center gap-2 mb-1">
                            <h3 className="font-semibold text-gray-900 dark:text-white">
                              Functional Cookies
                            </h3>
                            <span className="text-xs bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-400 px-2 py-0.5 rounded-full font-medium">
                              Optional
                            </span>
                          </div>
                          <p className="text-xs text-gray-600 dark:text-gray-400">
                            Remember your preferences and settings for a better experience.
                          </p>
                        </div>
                        <div className="ml-4">
                          <button
                            onClick={() => togglePreference('functional')}
                            className={`w-12 h-6 rounded-full flex items-center transition-colors ${
                              preferences.functional
                                ? 'bg-blue-500 justify-end'
                                : 'bg-gray-300 dark:bg-gray-600 justify-start'
                            } px-1`}
                          >
                            <div className="w-5 h-5 bg-white rounded-full" />
                          </button>
                        </div>
                      </div>
                      <p className="text-xs text-gray-500 dark:text-gray-500 mt-2">
                        Examples: Quiz progress, theme preferences, language settings
                      </p>
                    </div>
                  </div>

                  {/* Action Buttons */}
                  <div className="flex flex-col md:flex-row gap-3">
                    <button
                      onClick={handleSavePreferences}
                      className="flex-1 bg-gradient-to-r from-blue-500 to-purple-600 hover:from-blue-600 hover:to-purple-700 text-white px-6 py-3 rounded-lg font-semibold transition-all transform hover:scale-105 flex items-center justify-center gap-2"
                    >
                      <CheckCircle className="w-5 h-5" />
                      Save Preferences
                    </button>
                    <button
                      onClick={() => setShowSettings(false)}
                      className="flex-1 border-2 border-gray-300 dark:border-gray-600 text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700 px-6 py-3 rounded-lg font-semibold transition-colors"
                    >
                      Back
                    </button>
                  </div>
                </div>
              )}
            </div>

            {/* Footer */}
            <div className="bg-gray-50 dark:bg-gray-900/50 px-6 py-3 text-xs text-gray-500 dark:text-gray-400 border-t border-gray-200 dark:border-gray-700">
              <p>
                🇪🇺 GDPR Compliant • 🔒 Your privacy matters •{" "}
                <Link href="/privacy-policy" className="text-blue-600 dark:text-blue-400 hover:underline">
                  Learn more
                </Link>
              </p>
            </div>
          </div>
        </div>
      </div>
    </>
  );
}

// Optional: Export a function to check if analytics consent is given
export function hasAnalyticsConsent(): boolean {
  try {
    const consent = localStorage.getItem('cookie_consent');
    if (!consent) return false;
    const parsed = JSON.parse(consent);
    return parsed.analytics === true;
  } catch {
    return false;
  }
}

// Optional: Export a function to programmatically show the cookie banner again
export function showCookieConsent() {
  localStorage.removeItem('cookie_consent');
  localStorage.removeItem('cookie_consent_date');
  window.location.reload();
}






















