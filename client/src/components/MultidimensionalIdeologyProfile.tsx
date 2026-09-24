import React, { useState } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { DIMENSION_POLES, IDEOLOGY_DIMENSIONS, type IdeologyDimension, type IdeologyVector } from '@shared/ideology';
import { DIMENSION_STYLE, describePosition } from '@/lib/ideologyDisplay';

interface MultidimensionalIdeologyProfileProps {
  dimensions: IdeologyVector;
  ideology: string;
  description: string;
}

// What each dimension measures. Pole names come from DIMENSION_POLES.
const DIMENSION_MEASURES: Record<IdeologyDimension, string> = {
  economic: "How much the state should shape the economy.",
  social: "Attitudes toward social norms, values and social change.",
  cultural: "Attitudes toward cultural identity, traditions, and heritage.",
  authority: "Attitudes toward authority, personal freedom, and social control.",
  environmental: "Priority given to environmental protection versus economic growth.",
  welfare: "How much support should come from the state versus individuals and families.",
  globalism: "Attitudes toward international cooperation, sovereignty, and borders.",
  technocratic: "Trust in expertise versus popular opinion in decision-making.",
};

const formatValue = (value: number) => `${value > 0 ? '+' : ''}${value.toFixed(1)}`;

// Convert scores from -10 to +10 scale to 0-100% for display
const getProgressValue = (value: number): number => ((value + 10) / 20) * 100;

const MultidimensionalIdeologyProfile: React.FC<MultidimensionalIdeologyProfileProps> = ({
  dimensions,
  ideology,
  description,
}) => {
  const [expandedDimension, setExpandedDimension] = useState<IdeologyDimension | null>(null);

  const toggleDimension = (dimension: IdeologyDimension) => {
    setExpandedDimension((current) => (current === dimension ? null : dimension));
  };

  return (
    <Card className="w-full">
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <span>Your Political Profile</span>
          <span className="text-sm font-normal text-muted-foreground">(8-Dimensional Analysis)</span>
        </CardTitle>
        <CardDescription>
          Expanded political analysis using eight distinct ideological dimensions
        </CardDescription>
      </CardHeader>

      <CardContent>
        <div className="mb-6">
          <h3 className="text-xl font-semibold mb-2">{ideology}</h3>
          <p className="text-gray-600 dark:text-gray-400">{description}</p>
        </div>

        <Tabs defaultValue="bars" className="w-full">
          <TabsList className="grid w-full grid-cols-2">
            <TabsTrigger value="bars">Dimension Bars</TabsTrigger>
            <TabsTrigger value="details">Detailed Analysis</TabsTrigger>
          </TabsList>

          <TabsContent value="bars" className="space-y-4 pt-4">
            {IDEOLOGY_DIMENSIONS.map((dim) => {
              const value = dimensions[dim];
              const poles = DIMENSION_POLES[dim];
              const style = DIMENSION_STYLE[dim];

              return (
                <div key={dim} className="space-y-1">
                  <div className="flex justify-between items-center">
                    <div className="flex items-center">
                      <span className="mr-2 text-xl">{style.icon}</span>
                      <span className="font-medium">{poles.label}</span>
                    </div>
                    <span className="text-sm font-mono">{formatValue(value)}</span>
                  </div>

                  <div className="relative h-8">
                    <div className="absolute inset-0 flex">
                      <div className="w-1/2 bg-gray-100 dark:bg-gray-800 flex justify-end items-center pr-2 text-xs text-gray-500">
                        {poles.negative}
                      </div>
                      <div className="w-1/2 bg-gray-200 dark:bg-gray-700 flex justify-start items-center pl-2 text-xs text-gray-500">
                        {poles.positive}
                      </div>
                    </div>

                    <div className="absolute inset-0 w-full">
                      <div className="absolute top-0 bottom-0 w-px bg-gray-400 left-1/2 z-10"></div>
                      <div
                        className="absolute top-0 bottom-0 rounded-full transition-all duration-500 z-20"
                        style={{
                          width: '12px',
                          left: `calc(${getProgressValue(value)}% - 6px)`,
                          backgroundColor: style.color,
                        }}
                      ></div>
                    </div>
                  </div>

                  <Button
                    variant="link"
                    size="sm"
                    onClick={() => toggleDimension(dim)}
                    className="p-0 h-auto text-xs text-muted-foreground"
                  >
                    {describePosition(dim, value)}
                  </Button>

                  {expandedDimension === dim && (
                    <div className="mt-2 p-3 bg-gray-50 dark:bg-gray-800 rounded-md text-sm">
                      <p className="mb-2">
                        Your score of <strong>{formatValue(value)}</strong> on the {poles.label} dimension
                        {value === 0
                          ? ' sits at the centre.'
                          : ` means you lean toward the ${value > 0 ? poles.positive : poles.negative} side.`}
                      </p>
                      <p className="text-xs text-gray-600 dark:text-gray-400">
                        {DIMENSION_MEASURES[dim]} −10 is {poles.negative}; +10 is {poles.positive}.
                      </p>
                    </div>
                  )}
                </div>
              );
            })}
          </TabsContent>

          <TabsContent value="details" className="pt-4">
            <div className="space-y-4">
              <div>
                <h3 className="text-lg font-semibold mb-2">Multidimensional Analysis</h3>
                <p className="text-sm text-gray-600 dark:text-gray-400 mb-4">
                  This expanded analysis looks beyond the traditional left-right spectrum to capture the nuance and complexity of your political beliefs across 8 distinct dimensions.
                </p>
              </div>

              <div className="grid gap-4">
                {IDEOLOGY_DIMENSIONS.map((dim) => {
                  const value = dimensions[dim];
                  const poles = DIMENSION_POLES[dim];
                  const style = DIMENSION_STYLE[dim];
                  return (
                    <Card key={dim} className="overflow-hidden">
                      <div
                        className="h-1.5"
                        style={{ backgroundColor: style.color }}
                      ></div>
                      <CardContent className="pt-4">
                        <div className="flex justify-between items-center mb-2">
                          <h4 className="font-semibold flex items-center">
                            <span className="mr-2 text-xl">{style.icon}</span>
                            <span className="dimension-tooltip">
                              {poles.label} Dimension
                              <span className="tooltip-text">
                                <p>{DIMENSION_MEASURES[dim]}</p>
                                <p className="mt-1"><strong>-10</strong>: {poles.negative}</p>
                                <p><strong>+10</strong>: {poles.positive}</p>
                              </span>
                            </span>
                          </h4>
                          <span className="text-sm font-mono bg-gray-100 dark:bg-gray-800 px-2 py-0.5 rounded">
                            {formatValue(value)}
                          </span>
                        </div>
                        <p className="text-sm mb-3">
                          {describePosition(dim, value)}. {DIMENSION_MEASURES[dim]}
                        </p>
                        <div className="text-xs text-gray-500 dark:text-gray-400 flex justify-between">
                          <span>{poles.negative} (-10)</span>
                          <span>{poles.positive} (+10)</span>
                        </div>
                        <div className="relative h-2 bg-gray-200 dark:bg-gray-700 rounded-full mt-1">
                          <div className="absolute top-0 bottom-0 left-1/2 bg-gray-400 w-0.5 transform -translate-x-1/2"></div>
                          <div
                            className="absolute top-0 bottom-0 rounded-full"
                            style={{
                              width: `8px`,
                              left: `calc(${getProgressValue(value)}% - 4px)`,
                              backgroundColor: style.color
                            }}
                          ></div>
                        </div>
                      </CardContent>
                    </Card>
                  );
                })}
              </div>
            </div>
          </TabsContent>
        </Tabs>
      </CardContent>
    </Card>
  );
};

export default MultidimensionalIdeologyProfile;
