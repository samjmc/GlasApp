import { Card, CardContent } from "@/components/ui/card";

interface PoliticalFigure {
  id: string;
  name: string;
  economic: number;
  social: number;
  description: string;
  imageUrl?: string;
}

interface CompassChartProps {
  economic: number;
  social: number;
  similarFigures: PoliticalFigure[];
}

const CompassChart = ({ economic, social, similarFigures }: CompassChartProps) => {
  // Convert the -10 to 10 scale to percentages for positioning
  // -10 = 0%, 0 = 50%, 10 = 100%
  const economicPosition = ((economic + 10) / 20) * 100;
  const socialPosition = ((10 - social) / 20) * 100; // Inverted since top is authoritarian
  
  return (
    <Card className="bg-white dark:bg-gray-800 rounded-lg shadow-md">
      <CardContent className="p-6">
        <h3 className="text-xl font-semibold mb-4">Your Political Position</h3>
        
        <div className="aspect-square w-full max-w-md mx-auto relative compass-grid rounded border border-gray-200 dark:border-gray-700">
          <div className="compass-axis-x absolute left-0 right-0 top-1/2 transform -translate-y-1/2 h-[2px] bg-gray-400 dark:bg-gray-600"></div>
          <div className="compass-axis-y absolute top-0 bottom-0 left-1/2 transform -translate-x-1/2 w-[2px] bg-gray-400 dark:bg-gray-600"></div>
          
          {/* Axis Labels */}
          <div className="compass-label absolute left-2 top-1/2 transform -translate-y-1/2 text-red-500 dark:text-red-400 font-semibold text-sm">Left</div>
          <div className="compass-label absolute right-2 top-1/2 transform -translate-y-1/2 text-blue-500 dark:text-blue-400 font-semibold text-sm">Right</div>
          <div className="compass-label absolute bottom-2 left-1/2 transform -translate-x-1/2 text-green-500 dark:text-green-400 font-semibold text-sm">Libertarian</div>
          <div className="compass-label absolute top-2 left-1/2 transform -translate-x-1/2 text-amber-500 dark:text-amber-400 font-semibold text-sm">Authoritarian</div>
          
          {/* User's Position */}
          <div 
            className="compass-point absolute w-4 h-4 bg-indigo-600 rounded-full transform -translate-x-1/2 -translate-y-1/2 border-2 border-white dark:border-gray-800 shadow-md z-10"
            style={{ left: `${economicPosition}%`, top: `${socialPosition}%` }}
          ></div>
          
          {/* Similar Figures */}
          {similarFigures.slice(0, 3).map((figure, index) => {
            const figureEconomicPos = ((figure.economic + 10) / 20) * 100;
            const figureSocialPos = ((10 - figure.social) / 20) * 100;
            
            // Array of colors for the dots
            const colors = ["#60A5FA", "#F472B6", "#A78BFA"];
            
            return (
              <div 
                key={figure.id}
                className="compass-point absolute w-3 h-3 rounded-full transform -translate-x-1/2 -translate-y-1/2"
                style={{ 
                  left: `${figureEconomicPos}%`, 
                  top: `${figureSocialPos}%`,
                  backgroundColor: colors[index % colors.length]
                }}
              ></div>
            );
          })}
        </div>
        
        <div className="flex justify-center mt-4 text-sm">
          <div className="flex items-center mr-4">
            <span className="inline-block w-3 h-3 rounded-full bg-indigo-600 mr-1"></span>
            <span>You</span>
          </div>
          <div className="flex items-center">
            <span className="inline-block w-3 h-3 rounded-full bg-pink-400 mr-1"></span>
            <span>Similar Figures</span>
          </div>
        </div>
      </CardContent>
    </Card>
  );
};

export default CompassChart;
