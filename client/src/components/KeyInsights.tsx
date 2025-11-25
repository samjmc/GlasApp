import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

interface KeyInsightsProps {
  insights: string[];
}

const KeyInsights = ({ insights }: KeyInsightsProps) => {
  // If no insights are available, don't render the component
  if (!insights || insights.length === 0) return null;

  return (
    <Card className="bg-white dark:bg-gray-800 shadow-md">
      <CardHeader className="pb-2">
        <CardTitle className="text-xl font-bold">AI Analysis Insights</CardTitle>
      </CardHeader>
      <CardContent>
        <p className="text-sm text-gray-600 dark:text-gray-300 mb-4">
          Based on your written responses, our AI has identified these key insights about your political views:
        </p>
        
        <ul className="space-y-3">
          {insights.map((insight, index) => (
            <li key={index} className="flex">
              <div className="flex-shrink-0 w-6 h-6 rounded-full bg-indigo-100 dark:bg-indigo-900 flex items-center justify-center mr-3">
                <span className="text-indigo-600 dark:text-indigo-400 text-sm font-medium">{index + 1}</span>
              </div>
              <div className="text-gray-700 dark:text-gray-300 leading-tight">{insight}</div>
            </li>
          ))}
        </ul>
        
        <div className="mt-4 pt-3 border-t border-gray-200 dark:border-gray-700 text-xs text-gray-500 dark:text-gray-400">
          These insights are generated using advanced AI analysis of your free-text responses.
        </div>
      </CardContent>
    </Card>
  );
};

export default KeyInsights;