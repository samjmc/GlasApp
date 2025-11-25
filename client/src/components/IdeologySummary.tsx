import { Card, CardContent } from "@/components/ui/card";

interface IdeologySummaryProps {
  ideology: string;
  description: string;
}

const IdeologySummary = ({ ideology, description }: IdeologySummaryProps) => {
  return (
    <Card className="bg-white dark:bg-gray-800 rounded-lg shadow-md">
      <CardContent className="p-6">
        <h3 className="text-xl font-semibold mb-4">Your Ideology Summary</h3>
        <p className="mb-4 text-gray-700 dark:text-gray-300">
          As a <strong>{ideology}</strong>, {description}
        </p>
      </CardContent>
    </Card>
  );
};

export default IdeologySummary;
