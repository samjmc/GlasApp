import { useLocation, Link } from "wouter";

interface NavItem {
  path: string;
  label: string;
  icon: string;
}

const BottomNavigation = () => {
  const [location] = useLocation();
  const normalizedLocation = location.split("?")[0];

  const isActive = (path: string) => {
    if (path === "/") {
      return normalizedLocation === "/";
    }
    // Special case: quiz tab should be active for both /enhanced-quiz and /enhanced-results
    if (path === "/enhanced-quiz") {
      return (
        normalizedLocation === "/enhanced-quiz" || 
        normalizedLocation === "/enhanced-results" || 
        normalizedLocation.startsWith("/enhanced-quiz/") || 
        normalizedLocation.startsWith("/enhanced-results/")
      );
    }
    return (
      normalizedLocation === path || normalizedLocation.startsWith(`${path}/`)
    );
  };
  
  const navItems: NavItem[] = [
    { path: "/", label: "Home", icon: "🏠" },
    { path: "/debates", label: "Debates", icon: "🗣️" },
    { path: "/ask-td", label: "Ask TD", icon: "🤖" },
    { path: "/enhanced-quiz", label: "Quiz", icon: "🧠" },
    { path: "/my-politics", label: "Profile", icon: "🎯" },
  ];
  
  return (
    <div
      className="fixed inset-x-0 bottom-0 z-[9999] bg-white dark:bg-gray-950 backdrop-blur-md md:hidden"
      style={{ 
        paddingBottom: "env(safe-area-inset-bottom, 0px)",
        position: "fixed",
        left: 0,
        right: 0,
        bottom: 0,
        width: "100vw",
        maxWidth: "100vw",
        visibility: "visible",
        display: "block",
        pointerEvents: "auto",
        boxShadow: "0 -4px 6px -1px rgba(0, 0, 0, 0.1), 0 -2px 4px -1px rgba(0, 0, 0, 0.06)",
        transform: "translateZ(0)"
      }}
    >
      <div className="mx-auto w-full max-w-full px-0">
        <nav className="grid h-14 grid-cols-5 items-center gap-0.5 sm:h-16">
        {navItems.map((item) => (
          <Link
            key={item.path}
            href={item.path}
            className={`flex flex-col items-center justify-center rounded-xl py-1 text-[0.65rem] font-medium transition-colors sm:text-xs ${
              isActive(item.path)
                ? "bg-emerald-500/15 text-emerald-500"
                : "text-gray-600 dark:text-gray-400 hover:text-emerald-400"
            }`}
          >
            <span className="mb-0.5 text-xl sm:text-2xl">{item.icon}</span>
            <span className="truncate px-0.5">{item.label}</span>
          </Link>
        ))}
        </nav>
      </div>
    </div>
  );
};

export default BottomNavigation;
