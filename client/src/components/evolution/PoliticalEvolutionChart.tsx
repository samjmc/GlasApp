import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { useToast } from '@/components/ui/use-toast';
import { Skeleton } from '@/components/ui/skeleton';

interface PoliticalEvolutionPoint {
  id: number;
  userId: number;
  economicScore: number;
  socialScore: number;
  ideology: string;
  label: string | null;
  notes: string | null;
  createdAt: string;
}

const PoliticalEvolutionChart: React.FC = () => {
  const [evolutionData, setEvolutionData] = useState<PoliticalEvolutionPoint[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const { toast } = useToast();

  // Canvas dimensions
  const width = 600;
  const height = 600;
  const padding = 60;
  const innerWidth = width - (padding * 2);
  const innerHeight = height - (padding * 2);

  useEffect(() => {
    const fetchEvolutionData = async () => {
      try {
        setIsLoading(true);
        const response = await fetch('/api/political-evolution');
        const result = await response.json();
        
        if (result.success) {
          // Sort data by createdAt date
          const sortedData = [...result.data].sort((a, b) => 
            new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime()
          );
          setEvolutionData(sortedData);
        } else {
          setError(result.message || 'Failed to load political evolution data');
          toast({
            title: "Error",
            description: result.message || 'Failed to load political evolution data',
            variant: "destructive"
          });
        }
      } catch (err) {
        setError('An unexpected error occurred while fetching data');
        toast({
          title: "Error",
          description: 'Could not load political evolution data',
          variant: "destructive"
        });
      } finally {
        setIsLoading(false);
      }
    };

    fetchEvolutionData();
  }, [toast]);

  if (isLoading) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>
            <Skeleton className="h-8 w-3/4" />
          </CardTitle>
          <CardDescription>
            <Skeleton className="h-4 w-1/2" />
          </CardDescription>
        </CardHeader>
        <CardContent>
          <Skeleton className="h-[400px] w-full" />
        </CardContent>
      </Card>
    );
  }

  if (!evolutionData.length) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>Political Evolution</CardTitle>
          <CardDescription>Track how your political views change over time</CardDescription>
        </CardHeader>
        <CardContent className="flex flex-col items-center justify-center h-[400px]">
          <p className="text-center text-muted-foreground mb-4">
            You haven't recorded any political evolution points yet.
          </p>
          <p className="text-center text-sm text-muted-foreground">
            Take a quiz or manually add an evolution point to start tracking your political journey.
          </p>
        </CardContent>
      </Card>
    );
  }

  const renderChart = () => {
    // Generate SVG for political compass
    const mapValue = (value: number, min: number, max: number) => {
      return ((value - min) / (max - min)) * innerWidth;
    };

    const points = evolutionData.map((point, index) => {
      // Map economic score (-10 to 10) to x position (right is positive)
      const x = padding + mapValue(point.economicScore, -10, 10);
      
      // Map social score (-10 to 10) to y position (up is negative)
      // Invert the y-axis since SVG's 0,0 is top-left
      const y = padding + innerHeight - mapValue(point.socialScore, -10, 10);
      
      // Show only the last 5 points
      const isRecent = index >= Math.max(0, evolutionData.length - 5);
      
      return {
        x,
        y,
        data: point,
        isRecent,
        isLatest: index === evolutionData.length - 1
      };
    });
    
    // Generate path connecting the points
    const pathData = points.map((point, idx) => 
      `${idx === 0 ? 'M' : 'L'} ${point.x} ${point.y}`
    ).join(' ');

    return (
      <svg width="100%" height="400px" viewBox={`0 0 ${width} ${height}`} preserveAspectRatio="xMidYMid meet">
        {/* Background grid */}
        <defs>
          <pattern id="smallGrid" width={innerWidth/10} height={innerHeight/10} patternUnits="userSpaceOnUse">
            <path d="M 0 0 L 0 10 M 0 0 L 10 0" fill="none" stroke="rgba(200,200,200,0.3)" strokeWidth="0.5"/>
          </pattern>
          <pattern id="grid" width={innerWidth/2} height={innerHeight/2} patternUnits="userSpaceOnUse">
            <rect width={innerWidth/2} height={innerHeight/2} fill="url(#smallGrid)"/>
            <path d="M 0 0 L 0 100 M 0 0 L 100 0" fill="none" stroke="rgba(200,200,200,0.5)" strokeWidth="1"/>
          </pattern>
        </defs>
        
        {/* Grid background */}
        <rect
          x={padding}
          y={padding}
          width={innerWidth}
          height={innerHeight}
          fill="url(#grid)"
          stroke="#ccc"
          strokeWidth="1"
        />
        
        {/* X-axis (Economic) */}
        <line
          x1={padding}
          y1={padding + innerHeight/2}
          x2={padding + innerWidth}
          y2={padding + innerHeight/2}
          stroke="#666"
          strokeWidth="2"
        />
        
        {/* Y-axis (Social) */}
        <line
          x1={padding + innerWidth/2}
          y1={padding}
          x2={padding + innerWidth/2}
          y2={padding + innerHeight}
          stroke="#666"
          strokeWidth="2"
        />
        
        {/* Labels */}
        <text x={padding + innerWidth} y={padding + innerHeight/2 - 10} textAnchor="end" fill="#333" fontSize="12">Right</text>
        <text x={padding} y={padding + innerHeight/2 - 10} textAnchor="start" fill="#333" fontSize="12">Left</text>
        <text x={padding + innerWidth/2 + 10} y={padding} textAnchor="start" fill="#333" fontSize="12">Authoritarian</text>
        <text x={padding + innerWidth/2 + 10} y={padding + innerHeight} textAnchor="start" fill="#333" fontSize="12">Libertarian</text>
        
        {/* Quadrant labels */}
        <text x={padding + innerWidth*3/4} y={padding + innerHeight/4} textAnchor="middle" fill="#333" fontSize="12" fontWeight="bold">Authoritarian Right</text>
        <text x={padding + innerWidth/4} y={padding + innerHeight/4} textAnchor="middle" fill="#333" fontSize="12" fontWeight="bold">Authoritarian Left</text>
        <text x={padding + innerWidth*3/4} y={padding + innerHeight*3/4} textAnchor="middle" fill="#333" fontSize="12" fontWeight="bold">Libertarian Right</text>
        <text x={padding + innerWidth/4} y={padding + innerHeight*3/4} textAnchor="middle" fill="#333" fontSize="12" fontWeight="bold">Libertarian Left</text>
        
        {/* Path connecting points */}
        <path
          d={pathData}
          fill="none"
          stroke="#22c55e"
          strokeWidth="2"
          strokeDasharray="5,5"
        />
        
        {/* Points */}
        {points.map((point, idx) => (
          <g key={idx}>
            {/* Only show data points for recent entries */}
            {point.isRecent && (
              <circle
                cx={point.x}
                cy={point.y}
                r={point.isLatest ? 8 : 6}
                fill={point.isLatest ? "#15803d" : "#22c55e"}
                stroke="#fff"
                strokeWidth="2"
              />
            )}
            
            {/* Only show labels for the latest point */}
            {point.isLatest && (
              <g>
                <rect
                  x={point.x + 10}
                  y={point.y - 30}
                  width="140"
                  height="60"
                  rx="5"
                  ry="5"
                  fill="white"
                  stroke="#ccc"
                  strokeWidth="1"
                  opacity="0.9"
                />
                <text x={point.x + 20} y={point.y - 10} fill="#333" fontSize="12" fontWeight="bold">
                  {point.data.label || new Date(point.data.createdAt).toLocaleDateString()}
                </text>
                <text x={point.x + 20} y={point.y + 10} fill="#666" fontSize="11">
                  {point.data.ideology}
                </text>
                <text x={point.x + 20} y={point.y + 25} fill="#666" fontSize="10">
                  Econ: {point.data.economicScore.toFixed(1)}, Social: {point.data.socialScore.toFixed(1)}
                </text>
              </g>
            )}
          </g>
        ))}
      </svg>
    );
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle>Political Evolution</CardTitle>
        <CardDescription>
          Track how your political views have changed over time
        </CardDescription>
      </CardHeader>
      <CardContent>
        {error ? (
          <div className="text-center text-red-500 p-4">
            {error}
          </div>
        ) : (
          renderChart()
        )}
      </CardContent>
    </Card>
  );
};

export default PoliticalEvolutionChart;