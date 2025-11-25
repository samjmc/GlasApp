import { Card, CardContent } from "@/components/ui/card";
import { PoliticalFigure } from "@shared/schema";
import { useState } from "react";
import { Button } from "@/components/ui/button";

interface SimilarFiguresProps {
  figures: PoliticalFigure[];
}

const SimilarFigures = ({ figures }: SimilarFiguresProps) => {
  const [showAll, setShowAll] = useState(false);
  const initialCount = 3;
  const displayFigures = showAll ? figures : figures.slice(0, initialCount);
  
  return (
    <Card className="bg-white dark:bg-gray-800 rounded-lg shadow-md">
      <CardContent className="p-6">
        <div className="flex justify-between items-center mb-4">
          <h3 className="text-xl font-semibold">Similar Political Figures</h3>
          <div className="text-sm text-green-600 font-medium">
            {figures.length} matches found
          </div>
        </div>
        
        <div className="space-y-4">
          {displayFigures.map((figure, index) => (
            <div 
              key={figure.id} 
              className={`flex flex-col sm:flex-row ${
                index < displayFigures.length - 1 ? 'border-b border-gray-200 dark:border-gray-700 pb-4' : ''
              }`}
            >
              <div className="flex-shrink-0 mb-3 sm:mb-0">
                <img 
                  src={figure.imageUrl} 
                  alt={figure.name} 
                  className="w-16 h-16 object-cover rounded-full sm:mr-4"
                />
              </div>
              
              <div className="flex-grow">
                <h4 className="font-medium text-lg">{figure.name}</h4>
                <div className="flex flex-wrap text-sm text-gray-500 dark:text-gray-400 mb-2">
                  <span className="mr-3">
                    <span className="font-medium">Economic:</span> {figure.economic.toFixed(1)}
                  </span>
                  <span>
                    <span className="font-medium">Social:</span> {figure.social.toFixed(1)}
                  </span>
                  {figure.distance !== undefined && (
                    <span className="ml-3 text-green-600">
                      <span className="font-medium">Match:</span> {(100 - (figure.distance * 5)).toFixed(0)}%
                    </span>
                  )}
                </div>
                <p className="text-sm text-gray-600 dark:text-gray-300">
                  {figure.description}
                </p>
              </div>
            </div>
          ))}
        </div>
        
        {figures.length > initialCount && (
          <div className="mt-4 text-center">
            <Button 
              variant="outline" 
              className="mt-2 text-green-600 border-green-600 hover:bg-green-50"
              onClick={() => setShowAll(!showAll)}
            >
              {showAll ? "Show Less" : `Show ${figures.length - initialCount} More`}
            </Button>
          </div>
        )}
      </CardContent>
    </Card>
  );
};

export default SimilarFigures;
