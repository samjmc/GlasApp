/**
 * PWA Installation & Service Worker Management
 * Handles service worker registration, install prompts, and PWA lifecycle
 */

// Service Worker Registration
const isDevelopment = import.meta.env.DEV;

export async function registerServiceWorker(): Promise<ServiceWorkerRegistration | null> {
  if (isDevelopment) {
    console.log('⚠️  Skipping service worker registration in development mode.');
    return null;
  }

  if ('serviceWorker' in navigator) {
    try {
      const registration = await navigator.serviceWorker.register('/sw.js', {
        scope: '/'
      });
      
      console.log('✅ Service Worker registered successfully', registration);
      
      // Handle updates
      registration.addEventListener('updatefound', () => {
        const newWorker = registration.installing;
        if (newWorker) {
          newWorker.addEventListener('statechange', () => {
            if (newWorker.state === 'installed' && navigator.serviceWorker.controller) {
              // New service worker available, show update prompt
              showUpdateNotification();
            }
          });
        }
      });
      
      return registration;
    } catch (error) {
      console.error('❌ Service Worker registration failed:', error);
      return null;
    }
  }
  
  console.log('⚠️  Service Workers not supported in this browser');
  return null;
}

// Show update notification when new version is available
function showUpdateNotification() {
  if (confirm('A new version of Glas Politics is available! Reload to update?')) {
    window.location.reload();
  }
}

/**
 * Tracks installs. The install prompt itself is the PWAInstallButton component, which listens
 * for `beforeinstallprompt`; a second prompt here used to stack on top of it.
 */
export function setupInstallPrompt() {
  window.addEventListener('appinstalled', () => {
    console.log('✅ PWA was installed');
    trackInstallation();
  });
}

// Track installation
function trackInstallation() {
  // You can send this to your analytics
  console.log('PWA installed at:', new Date().toISOString());
  
  // Optional: Send to analytics endpoint
  fetch('/api/analytics/pwa-install', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      timestamp: new Date().toISOString(),
      userAgent: navigator.userAgent
    })
  }).catch(() => {
    // Silent fail - analytics not critical
  });
}

// Check if running as installed PWA
/** Returns whether the app is running as an installed PWA. */
export function isInstalledPWA(): boolean {
  return window.matchMedia('(display-mode: standalone)').matches ||
         (window.navigator as Navigator & { standalone?: boolean }).standalone === true || // iOS
         document.referrer.includes('android-app://');
}

// Get PWA display mode
/** Returns the current PWA display mode (fullscreen, standalone, minimal-ui, or browser). */
export function getPWADisplayMode(): string {
  const isStandalone = window.matchMedia('(display-mode: standalone)').matches;
  const isFullscreen = window.matchMedia('(display-mode: fullscreen)').matches;
  const isMinimalUI = window.matchMedia('(display-mode: minimal-ui)').matches;
  
  if (isFullscreen) return 'fullscreen';
  if (isStandalone) return 'standalone';
  if (isMinimalUI) return 'minimal-ui';
  return 'browser';
}

// Initialize PWA features
/** Initializes service worker registration and install prompt setup. */
export function initializePWA() {
  console.log('🚀 Initializing PWA features...');
  console.log('📱 Display mode:', getPWADisplayMode());
  console.log('📲 Is installed:', isInstalledPWA());
  
  // Register service worker
  registerServiceWorker();
  
  // Setup install prompt
  setupInstallPrompt();
  
  // Log PWA status
  if (isInstalledPWA()) {
    console.log('✅ Running as installed PWA');
  } else {
    console.log('🌐 Running in browser mode');
  }
}

// Utility: Request push notification permission
export async function requestNotificationPermission(): Promise<NotificationPermission> {
  if (!('Notification' in window)) {
    console.log('⚠️  Notifications not supported');
    return 'denied';
  }
  
  if (Notification.permission === 'granted') {
    return 'granted';
  }
  
  if (Notification.permission !== 'denied') {
    const permission = await Notification.requestPermission();
    return permission;
  }
  
  return Notification.permission;
}

// Utility: Subscribe to push notifications
export async function subscribeToPushNotifications(registration: ServiceWorkerRegistration) {
  try {
    const subscription = await registration.pushManager.subscribe({
      userVisibleOnly: true,
      applicationServerKey: urlBase64ToUint8Array(
        // Replace with your VAPID public key
        'YOUR_VAPID_PUBLIC_KEY'
      )
    });
    
    console.log('✅ Push notification subscription:', subscription);
    
    // Send subscription to server
    await fetch('/api/push/subscribe', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(subscription)
    });
    
    return subscription;
  } catch (error) {
    console.error('❌ Push subscription failed:', error);
    return null;
  }
}

// Helper function for VAPID key conversion
function urlBase64ToUint8Array(base64String: string): Uint8Array {
  const padding = '='.repeat((4 - base64String.length % 4) % 4);
  const base64 = (base64String + padding)
    .replace(/\-/g, '+')
    .replace(/_/g, '/');
  
  const rawData = window.atob(base64);
  const outputArray = new Uint8Array(rawData.length);
  
  for (let i = 0; i < rawData.length; ++i) {
    outputArray[i] = rawData.charCodeAt(i);
  }
  
  return outputArray;
}

// Export for use in app
/** PWA utility object bundling install, display mode, and push notification helpers. */
export const PWA = {
  initialize: initializePWA,
  isInstalled: isInstalledPWA,
  getDisplayMode: getPWADisplayMode,
  requestNotifications: requestNotificationPermission,
  subscribeToPush: subscribeToPushNotifications
};



