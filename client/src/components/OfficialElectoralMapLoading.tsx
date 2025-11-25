import React from 'react';
import glasLogo from '@assets/glas_logo_3d_ripple.png';

/**
 * A loading component that shows the Glas logo and a progress indicator
 * Used to provide visual feedback while the detailed electoral map loads
 */
const OfficialElectoralMapLoading: React.FC = () => {
  return (
    <div className="relative w-full h-full flex flex-col items-center justify-center bg-gray-100 dark:bg-gray-800 rounded-lg">
      {/* Use Glas logo instead of Ireland outline */}
      <div className="w-48 mb-6">
        <img 
          src={glasLogo} 
          alt="Glas Politics" 
          className="w-full h-auto"
        />
      </div>
      
      <div className="flex flex-col items-center">
        <div className="w-64 h-3 bg-gray-200 dark:bg-gray-700 rounded-full overflow-hidden">
          <div className="loading-bar h-full bg-green-600 rounded-full"></div>
        </div>
        <div className="mt-6 text-center">
          <h3 className="text-lg font-semibold text-green-800 dark:text-green-400">
            Loading Electoral Map
          </h3>
          <p className="text-sm text-gray-600 dark:text-gray-300 mt-2">
            Please wait while we prepare the constituency boundaries...
          </p>
        </div>
      </div>
      
      <div className="mt-6 text-center max-w-xs text-xs text-gray-500 dark:text-gray-400">
        <p>Using official Electoral Commission data from the 2023 boundaries</p>
      </div>
      
      <style dangerouslySetInnerHTML={{
          __html: `
            .loading-bar {
              width: 0%;
              animation: loading 2.5s infinite ease-in-out;
            }
            @keyframes loading {
              0% { width: 5%; }
              50% { width: 70%; }
              75% { width: 90%; }
              90% { width: 95%; }
              100% { width: 5%; }
            }
          `
        }} />
    </div>
  );
};

export default OfficialElectoralMapLoading;