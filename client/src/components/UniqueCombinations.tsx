import { Card, CardContent } from "@/components/ui/card";

interface UniqueCombination {
  title: string;
  description: string;
}

interface UniqueCombinationsProps {
  combinations: UniqueCombination[];
}

const UniqueCombinations = ({ combinations }: UniqueCombinationsProps) => {
  // Colors for the different combinations
  const colors = [
    { bg: "bg-purple-50 dark:bg-purple-900/20", text: "text-purple-700 dark:text-purple-300" },
    { bg: "bg-blue-50 dark:bg-blue-900/20", text: "text-blue-700 dark:text-blue-300" },
    { bg: "bg-green-50 dark:bg-green-900/20", text: "text-green-700 dark:text-green-300" },
    { bg: "bg-amber-50 dark:bg-amber-900/20", text: "text-amber-700 dark:text-amber-300" },
    { bg: "bg-rose-50 dark:bg-rose-900/20", text: "text-rose-700 dark:text-rose-300" }
  ];

  return (
    <Card className="bg-white dark:bg-gray-800 rounded-lg shadow-md">
      <CardContent className="p-6">
        <h3 className="text-xl font-semibold mb-4">Your Unique Combinations</h3>
        <div className="space-y-4">
          {combinations.map((combo, index) => (
            <div 
              key={index} 
              className={`p-4 ${colors[index % colors.length].bg} rounded-md`}
            >
              <h4 className={`font-medium mb-2 ${colors[index % colors.length].text}`}>
                {combo.title}
              </h4>
              <p className="text-gray-700 dark:text-gray-300 text-sm">
                {combo.description}
              </p>
            </div>
          ))}
        </div>
      </CardContent>
    </Card>
  );
};

export default UniqueCombinations;
