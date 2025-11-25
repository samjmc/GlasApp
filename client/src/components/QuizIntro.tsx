import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";

interface QuizIntroProps {
  onStartQuiz: () => void;
}

const QuizIntro = ({ onStartQuiz }: QuizIntroProps) => {
  return (
    <Card className="bg-white dark:bg-gray-800 rounded-lg shadow-md mb-8">
      <CardContent className="p-6">
        <h2 className="text-2xl font-bold mb-4">Discover Your Political Position</h2>
        <p className="mb-6 text-gray-600 dark:text-gray-300">
          Answer 12 questions to find out where you stand on the political compass. 
          See how your views compare to political figures and parties around the world.
        </p>
        <div className="flex flex-col sm:flex-row space-y-4 sm:space-y-0 sm:space-x-4">
          <Button 
            onClick={onStartQuiz}
            className="bg-indigo-600 hover:bg-indigo-700 text-white font-medium py-2 px-6"
          >
            Start Quiz
          </Button>
          <Button 
            variant="outline"
            className="border border-gray-300 dark:border-gray-600 hover:bg-gray-100 dark:hover:bg-gray-700 font-medium py-2 px-6"
          >
            About the Compass
          </Button>
        </div>
      </CardContent>
    </Card>
  );
};

export default QuizIntro;
