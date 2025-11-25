import React from 'react';
import { useQuery } from '@tanstack/react-query';
import { PoliticalEvolutionRecord } from '@shared/schema';
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
  ReferenceLine
} from 'recharts';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { useAuth } from '@/contexts/AuthContext';

interface PoliticalEvolutionChartProps {
  onTakeQuiz?: () => void;
}

const PoliticalEvolutionChart = ({ onTakeQuiz }: PoliticalEvolutionChartProps) => {
  const { isAuthenticated } = useAuth();
  
  // Fetch political evolution data
  const { data: evolutionData, isLoading, error } = useQuery({
    queryKey: ['/api/political-evolution'],
    enabled: isAuthenticated,
  });
  
  if (!isAuthenticated) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>Track Your Political Evolution</CardTitle>
          <CardDescription>
            Sign in to track how your political views change over time
          </CardDescription>
        </CardHeader>
        <CardContent className="flex flex-col items-center justify-center py-8">
          <p className="text-center mb-4">
            Create an account or sign in to track your political evolution over time.
          </p>
          <div className="flex gap-4">
            <Button onClick={() => window.location.href = '/register'}>
              Register
            </Button>
            <Button variant="outline" onClick={() => window.location.href = '/login'}>
              Login
            </Button>
          </div>
        </CardContent>
      </Card>
    );
  }
  
  if (isLoading) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>Your Political Evolution</CardTitle>
          <CardDescription>
            See how your political views have changed over time
          </CardDescription>
        </CardHeader>
        <CardContent className="flex justify-center items-center py-12">
          <p>Loading your political evolution data...</p>
        </CardContent>
      </Card>
    );
  }
  
  if (error || !evolutionData || (evolutionData as any[]).length === 0) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>Your Political Evolution</CardTitle>
          <CardDescription>
            See how your political views have changed over time
          </CardDescription>
        </CardHeader>
        <CardContent className="flex flex-col items-center justify-center py-8">
          <p className="text-center mb-4">
            No political evolution data available yet.
          </p>
          {onTakeQuiz && (
            <Button onClick={onTakeQuiz}>
              Take the quiz to start tracking
            </Button>
          )}
        </CardContent>
      </Card>
    );
  }
  
  // Format evolution data for the chart
  const chartData = (evolutionData as PoliticalEvolutionRecord[]).map((record) => {
    const date = new Date(record.createdAt);
    return {
      date: date.toLocaleDateString('en-IE', { 
        day: 'numeric', 
        month: 'short', 
        year: 'numeric'
      }),
      economic: Number(record.economicScore),
      social: Number(record.socialScore),
      ideology: record.ideology,
      label: record.label || '',
      tooltipLabel: record.label ? `${date.toLocaleDateString()} - ${record.label}` : date.toLocaleDateString(),
    };
  });
  
  return (
    <Card>
      <CardHeader>
        <CardTitle>Your Political Evolution</CardTitle>
        <CardDescription>
          See how your political views have changed over time
        </CardDescription>
      </CardHeader>
      <CardContent>
        <div className="h-80">
          <ResponsiveContainer width="100%" height="100%">
            <LineChart data={chartData}>
              <CartesianGrid strokeDasharray="3 3" opacity={0.6} />
              <XAxis dataKey="date" />
              <YAxis domain={[-10, 10]} />
              <Tooltip 
                formatter={(value, name) => [
                  value, 
                  name === 'economic' ? 'Economic (Left-Right)' : 'Social (Libertarian-Authoritarian)'
                ]}
                labelFormatter={(label) => {
                  const record = chartData.find(r => r.date === label);
                  return record?.label ? `${label} - ${record.label}` : label;
                }}
              />
              <Legend />
              <ReferenceLine y={0} stroke="#666" strokeDasharray="3 3" />
              <ReferenceLine x={0} stroke="#666" strokeDasharray="3 3" />
              <Line 
                type="monotone" 
                dataKey="economic" 
                name="Economic"
                stroke="#8884d8" 
                activeDot={{ r: 8 }} 
                dot={{ r: 4 }}
              />
              <Line 
                type="monotone" 
                dataKey="social" 
                name="Social"
                stroke="#82ca9d" 
                dot={{ r: 4 }}
              />
            </LineChart>
          </ResponsiveContainer>
        </div>
        <div className="mt-4 text-center text-sm text-muted-foreground">
          <p>Economic Scale: -10 (Left) to +10 (Right)</p>
          <p>Social Scale: -10 (Libertarian) to +10 (Authoritarian)</p>
        </div>
        <div className="mt-6">
          <h3 className="font-medium mb-2">Your Political Journey</h3>
          <div className="space-y-2">
            {chartData.map((point, index) => (
              <div key={index} className="flex items-center p-2 rounded-md bg-muted/50">
                <div className="flex-1">
                  <p className="font-medium">{point.date}</p>
                  <p className="text-sm text-muted-foreground">{point.ideology} {point.label && `(${point.label})`}</p>
                </div>
                <div className="text-right">
                  <p>Economic: {point.economic > 0 ? '+' : ''}{point.economic.toFixed(1)}</p>
                  <p>Social: {point.social > 0 ? '+' : ''}{point.social.toFixed(1)}</p>
                </div>
              </div>
            ))}
          </div>
        </div>
      </CardContent>
    </Card>
  );
};

export default PoliticalEvolutionChart;