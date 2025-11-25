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

// Install Prompt Management
let deferredPrompt: any = null;

export function setupInstallPrompt() {
  window.addEventListener('beforeinstallprompt', (e) => {
    // Prevent the mini-infobar from appearing on mobile
    e.preventDefault();
    // Stash the event so it can be triggered later
    deferredPrompt = e;
    
    // Show custom install UI
    showInstallPromotion();
    
    console.log('📱 Install prompt ready');
  });

  // Track if user installed the app
  window.addEventListener('appinstalled', () => {
    console.log('✅ PWA was installed');
    deferredPrompt = null;
    hideInstallPromotion();
    
    // Track installation (analytics)
    trackInstallation();
  });
}

// Show custom install promotion
function showInstallPromotion() {
  // Check if already installed
  if (window.matchMedia('(display-mode: standalone)').matches) {
    return; // Already running as installed PWA
  }
  
  // Create install button (you can customize this)
  const installContainer = document.createElement('div');
  installContainer.id = 'pwa-install-prompt';
  installContainer.className = 'fixed bottom-20 left-4 right-4 bg-gradient-to-r from-emerald-500 to-teal-600 text-white p-4 rounded-lg shadow-2xl z-50 md:left-auto md:right-4 md:max-w-md';
  installContainer.innerHTML = `
    <div class="flex items-center justify-between gap-3">
      <div class="flex-1">
        <p class="font-semibold text-sm">Install Glas Politics</p>
        <p class="text-xs opacity-90">Add to your home screen for quick access!</p>
      </div>
      <div class="flex gap-2">
        <button id="pwa-install-btn" class="bg-white text-emerald-600 px-4 py-2 rounded-lg text-sm font-semibold hover:bg-emerald-50 transition-colors">
          Install
        </button>
        <button id="pwa-dismiss-btn" class="text-white opacity-75 hover:opacity-100 px-2">
          ✕
        </button>
      </div>
    </div>
  `;
  
  document.body.appendChild(installContainer);
  
  // Install button click
  document.getElementById('pwa-install-btn')?.addEventListener('click', async () => {
    if (deferredPrompt) {
      deferredPrompt.prompt();
      const { outcome } = await deferredPrompt.userChoice;
      console.log(`User response to install prompt: ${outcome}`);
      deferredPrompt = null;
    }
    hideInstallPromotion();
  });
  
  // Dismiss button click
  document.getElementById('pwa-dismiss-btn')?.addEventListener('click', () => {
    hideInstallPromotion();
    // Remember user dismissed (localStorage)
    localStorage.setItem('pwa-install-dismissed', Date.now().toString());
  });
  
  // Don't show if user dismissed recently (within 7 days)
  const dismissed = localStorage.getItem('pwa-install-dismissed');
  if (dismissed && Date.now() - parseInt(dismissed) < 7 * 24 * 60 * 60 * 1000) {
    hideInstallPromotion();
  }
}

function hideInstallPromotion() {
  const prompt = document.getElementById('pwa-install-prompt');
  if (prompt) {
    prompt.remove();
  }
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
export function isInstalledPWA(): boolean {
  return window.matchMedia('(display-mode: standalone)').matches ||
         (window.navigator as any).standalone === true || // iOS
         document.referrer.includes('android-app://');
}

// Get PWA display mode
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
export const PWA = {
  initialize: initializePWA,
  isInstalled: isInstalledPWA,
  getDisplayMode: getPWADisplayMode,
  requestNotifications: requestNotificationPermission,
  subscribeToPush: subscribeToPushNotifications
};



