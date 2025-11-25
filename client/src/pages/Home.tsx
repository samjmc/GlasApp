import { useLocation } from "wouter";
import QuizIntro from "@/components/QuizIntro";

const Home = () => {
  const [, navigate] = useLocation();

  const handleStartQuiz = () => {
    navigate("/enhanced-quiz");
  };

  return (
    <div className="max-w-2xl mx-auto">
      <QuizIntro onStartQuiz={handleStartQuiz} />
    </div>
  );
};

export default Home;
