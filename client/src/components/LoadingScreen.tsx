import { Progress } from "@/components/ui/progress";
import { useEffect, useState } from "react";
import glasLogo from '@assets/glas_logo_3d_ripple.png';

interface LoadingScreenProps {
  message?: string;
}

const LoadingScreen = ({ message = "Preparing Electoral Map" }: LoadingScreenProps) => {
  const [progress, setProgress] = useState(0);
  const [status, setStatus] = useState("Loading electoral boundaries...");

  useEffect(() => {
    // Simulate loading process
    const progressInterval = setInterval(() => {
      setProgress(prev => {
        const next = prev + (1.5 * Math.random());
        if (next > 100) {
          clearInterval(progressInterval);
          return 100;
        }
        return next;
      });
    }, 150);
    
    // Update status messages
    const statusMessages = [
      "Loading electoral boundaries...",
      "Processing constituency data...",
      "Preparing visualization...",
      "Loading electoral results...",
      "Almost ready..."
    ];
    
    statusMessages.forEach((msg, index) => {
      setTimeout(() => {
        setStatus(msg);
      }, (index + 1) * 1200);
    });
    
    return () => {
      clearInterval(progressInterval);
    };
  }, []);

  return (
    <div className="text-center py-10 px-4 flex flex-col items-center justify-center min-h-[400px]">
      {/* Glas Logo */}
      <div className="mb-8 w-full max-w-[240px]">
        <img 
          src={glasLogo} 
          alt="Glas Politics" 
          className="w-full h-auto"
        />
      </div>
      
      {/* Loading Animation */}
      <div className="rotating-border inline-block w-28 h-28 rounded-full mb-6 border-green-500">
        <div className="w-full h-full rounded-full bg-white dark:bg-gray-800 flex items-center justify-center">
          <svg xmlns="http://www.w3.org/2000/svg" width="36" height="36" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="text-green-600 animate-pulse">
            <path d="M15 21v-4a2 2 0 0 1 2-2h4"></path>
            <path d="M7 4v2a3 3 0 0 0 3 3h0a2 2 0 0 1 2 2v0"></path>
            <path d="M3 11h2a2 2 0 0 1 2 2v1"></path>
            <path d="M13 3h-2a3 3 0 0 0-3 3v1"></path>
            <path d="m21 3-6 6"></path>
          </svg>
        </div>
      </div>
      
      {/* Message */}
      <h3 className="text-xl font-semibold mb-2 text-green-800">{message}</h3>
      <p className="text-gray-600 dark:text-gray-300 mb-6">
        {status}
      </p>
      
      {/* Progress Bar */}
      <div className="max-w-md w-full mx-auto px-4">
        <div className="flex justify-between mb-2 text-sm">
          <span>Loading electoral data</span>
          <span>{Math.round(progress)}%</span>
        </div>
        <Progress value={progress} className="h-[6px]" />
        
        <p className="mt-6 text-xs text-gray-500">
          Using official Electoral Commission data from the 2023 boundaries
        </p>
      </div>
    </div>
  );
};

export default LoadingScreen;
