import { createRoot } from "react-dom/client";
import App from "./App";
import "./index.css";
import { TooltipProvider } from "@/components/ui/tooltip";
import { initializePWA } from "./pwa";

// Initialize PWA features
initializePWA();

createRoot(document.getElementById("root")!).render(
  <TooltipProvider>
    <App />
  </TooltipProvider>
);
