import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Slider } from "@/components/ui/slider";
import { Label } from "@/components/ui/label";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";

interface PoliticalEmojiAvatarProps {
  economicScore?: number;
  socialScore?: number;
  ideology?: string;
  onSave?: (avatar: string) => void;
  quizCompleted?: boolean;
}

type EmojiPart = {
  id: string;
  name: string;
  options: { value: string; label: string }[];
  currentIndex: number;
};

const PoliticalEmojiAvatar: React.FC<PoliticalEmojiAvatarProps> = ({
  economicScore = 0,
  socialScore = 0,
  ideology = "",
  onSave,
  quizCompleted = false
}) => {
  // Base emoji parts that make up the avatar
  const [emojiParts, setEmojiParts] = useState<EmojiPart[]>([
    {
      id: "base",
      name: "Base",
      options: [
        { value: "😀", label: "Smiling" },
        { value: "😊", label: "Blush" },
        { value: "🙂", label: "Slight Smile" },
        { value: "😐", label: "Neutral" },
        { value: "🤔", label: "Thinking" },
        { value: "😎", label: "Cool" },
        { value: "🧐", label: "Monocle" }
      ],
      currentIndex: 0
    },
    {
      id: "hat",
      name: "Hat",
      options: [
        { value: "", label: "None" },
        { value: "🎩", label: "Top Hat" },
        { value: "👒", label: "Sun Hat" },
        { value: "🧢", label: "Cap" },
        { value: "⛑️", label: "Rescue Worker's Helmet" },
        { value: "👑", label: "Crown" },
        { value: "🎓", label: "Graduation Cap" }
      ],
      currentIndex: 0
    },
    {
      id: "accessory",
      name: "Accessory",
      options: [
        { value: "", label: "None" },
        { value: "📱", label: "Phone" },
        { value: "💻", label: "Laptop" },
        { value: "📚", label: "Books" },
        { value: "🔨", label: "Hammer" },
        { value: "🧰", label: "Toolbox" },
        { value: "💰", label: "Money Bag" },
        { value: "🌱", label: "Seedling" }
      ],
      currentIndex: 0
    },
    {
      id: "flag",
      name: "Flag",
      options: [
        { value: "", label: "None" },
        { value: "🇮🇪", label: "Ireland" },
        { value: "🇪🇺", label: "European Union" },
        { value: "🏳️‍🌈", label: "Rainbow" },
        { value: "🌍", label: "Global" },
        { value: "⚖️", label: "Justice" }
      ],
      currentIndex: 0
    }
  ]);

  const [bgColor, setBgColor] = useState<string>("#4ade80"); // Default green for Glas

  // Suggest parts based on political leaning
  useEffect(() => {
    // Clone the current parts
    const newParts = [...emojiParts];
    
    // Suggest base emoji based on overall position
    const baseIndex = newParts.findIndex(part => part.id === "base");
    if (economicScore < -5) {
      newParts[baseIndex].currentIndex = 5; // Cool for far left
    } else if (economicScore > 5) {
      newParts[baseIndex].currentIndex = 6; // Monocle for far right
    }
    
    // Suggest hat based on economic position
    const hatIndex = newParts.findIndex(part => part.id === "hat");
    if (economicScore < -3) {
      newParts[hatIndex].currentIndex = 3; // Cap for left
    } else if (economicScore > 3) {
      newParts[hatIndex].currentIndex = 1; // Top hat for right
    } else if (socialScore > 3) {
      newParts[hatIndex].currentIndex = 5; // Crown for authoritarian
    }
    
    // Suggest accessory based on economic position
    const accessoryIndex = newParts.findIndex(part => part.id === "accessory");
    if (economicScore < -5) {
      newParts[accessoryIndex].currentIndex = 4; // Hammer for far left
    } else if (economicScore > 5) {
      newParts[accessoryIndex].currentIndex = 6; // Money bag for far right
    } else if (economicScore < 0 && socialScore < 0) {
      newParts[accessoryIndex].currentIndex = 7; // Seedling for green left
    } else if (economicScore > 0 && socialScore > 0) {
      newParts[accessoryIndex].currentIndex = 3; // Books for traditional right
    }
    
    // Background color suggestion
    if (economicScore < -5) {
      setBgColor("#ef4444"); // Red for far left
    } else if (economicScore > 5) {
      setBgColor("#3b82f6"); // Blue for far right
    } else if (socialScore > 5) {
      setBgColor("#8b5cf6"); // Purple for authoritarian
    } else if (socialScore < -5) {
      setBgColor("#10b981"); // Green for libertarian
    } else {
      setBgColor("#4ade80"); // Default Glas green
    }
    
    setEmojiParts(newParts);
  }, [economicScore, socialScore, ideology]);

  // Handle cycling through options for a part
  const cyclePart = (partId: string, direction: 1 | -1) => {
    setEmojiParts(current => 
      current.map(part => {
        if (part.id === partId) {
          const optionsLength = part.options.length;
          const newIndex = (part.currentIndex + direction + optionsLength) % optionsLength;
          return { ...part, currentIndex: newIndex };
        }
        return part;
      })
    );
  };

  // Randomize all parts
  const randomizeAvatar = () => {
    setEmojiParts(current =>
      current.map(part => {
        const randomIndex = Math.floor(Math.random() * part.options.length);
        return { ...part, currentIndex: randomIndex };
      })
    );
    
    // Randomize background color
    const colors = ["#4ade80", "#ef4444", "#3b82f6", "#8b5cf6", "#f59e0b", "#ec4899"];
    const randomColor = colors[Math.floor(Math.random() * colors.length)];
    setBgColor(randomColor);
  };

  // Generate a combined emoji avatar
  const generateAvatarEmoji = () => {
    return emojiParts.map(part => part.options[part.currentIndex].value).join("");
  };

  // Handle saving avatar
  const handleSave = () => {
    if (onSave) {
      onSave(generateAvatarEmoji());
    }
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle>Political Emoji Avatar</CardTitle>
        <CardDescription>
          Create a personalized emoji avatar based on your political leanings
          {!quizCompleted && (
            <div className="text-amber-600 dark:text-amber-500 font-medium mt-2 text-sm">
              Complete the political compass quiz to unlock your personalized avatar
            </div>
          )}
        </CardDescription>
      </CardHeader>
      <CardContent>
        {!quizCompleted ? (
          <div className="flex flex-col items-center py-8 text-center">
            <div className="text-6xl mb-4 opacity-40">🔒</div>
            <h3 className="text-lg font-medium mb-2">Avatar Creation Locked</h3>
            <p className="text-sm text-gray-500 mb-6 max-w-md mx-auto">
              Take the political compass quiz to discover your political position 
              and unlock your personalized emoji avatar creation.
            </p>
            <Button 
              variant="default" 
              onClick={() => window.location.href = '/enhanced-quiz'}
              className="bg-gradient-to-r from-green-600 to-emerald-600"
            >
              Take the Quiz
            </Button>
          </div>
        ) : (
          <>
            <div className="flex flex-col items-center mb-6">
              <div 
                className="text-6xl md:text-7xl mb-4 p-6 rounded-full" 
                style={{ backgroundColor: bgColor }}
              >
                {generateAvatarEmoji()}
              </div>
              
              <div className="flex gap-2 mt-2">
                <Button variant="outline" onClick={randomizeAvatar}>
                  Randomize
                </Button>
                <Button onClick={handleSave}>
                  Save Avatar
                </Button>
              </div>
            </div>

            <Tabs defaultValue="customize">
              <TabsList className="grid w-full grid-cols-2">
                <TabsTrigger value="customize">Customize</TabsTrigger>
                <TabsTrigger value="ideology">Political Look</TabsTrigger>
              </TabsList>
              
              <TabsContent value="customize">
                <div className="space-y-4 mt-4">
                  {emojiParts.map((part) => (
                    <div key={part.id} className="space-y-2">
                      <div className="flex justify-between items-center">
                        <Label>{part.name}</Label>
                        <div className="text-sm text-gray-500">
                          {part.options[part.currentIndex].label}
                        </div>
                      </div>
                      <div className="flex items-center gap-2">
                        <Button 
                          variant="outline" 
                          size="icon"
                          onClick={() => cyclePart(part.id, -1)}
                        >
                          ←
                        </Button>
                        <div className="flex-1 text-center text-2xl">
                          {part.options[part.currentIndex].value || "⬜"}
                        </div>
                        <Button 
                          variant="outline" 
                          size="icon"
                          onClick={() => cyclePart(part.id, 1)}
                        >
                          →
                        </Button>
                      </div>
                    </div>
                  ))}
                  
                  <div className="space-y-2">
                    <Label>Background Color</Label>
                    <div 
                      className="h-8 w-full rounded cursor-pointer border"
                      style={{ backgroundColor: bgColor }}
                      onClick={() => {
                        const colors = ["#4ade80", "#ef4444", "#3b82f6", "#8b5cf6", "#f59e0b", "#ec4899"];
                        const currentIndex = colors.indexOf(bgColor);
                        const nextIndex = (currentIndex + 1) % colors.length;
                        setBgColor(colors[nextIndex]);
                      }}
                    />
                  </div>
                </div>
              </TabsContent>
              
              <TabsContent value="ideology">
                <div className="space-y-4 mt-4">
                  <div className="space-y-2">
                    <Label>Economic Position ({economicScore.toFixed(1)})</Label>
                    <Slider
                      value={[economicScore + 10]}
                      min={0}
                      max={20}
                      step={0.1}
                      className="cursor-not-allowed opacity-70"
                    />
                    <div className="flex justify-between text-xs text-gray-500">
                      <span>Left</span>
                      <span>Center</span>
                      <span>Right</span>
                    </div>
                  </div>
                  
                  <div className="space-y-2">
                    <Label>Social Position ({socialScore.toFixed(1)})</Label>
                    <Slider
                      value={[socialScore + 10]}
                      min={0}
                      max={20}
                      step={0.1}
                      className="cursor-not-allowed opacity-70"
                    />
                    <div className="flex justify-between text-xs text-gray-500">
                      <span>Libertarian</span>
                      <span>Moderate</span>
                      <span>Authoritarian</span>
                    </div>
                  </div>
                  
                  <div className="pt-2">
                    <p className="text-sm font-medium mb-1">Your Political Identity:</p>
                    <p className="text-lg font-semibold">{ideology || "Centrist"}</p>
                    <p className="text-xs text-gray-500 mt-2">
                      Your avatar reflects your political position on the compass.
                      Left-leaning users get more progressive symbols, while
                      right-leaning users get more traditional ones.
                    </p>
                  </div>
                </div>
              </TabsContent>
            </Tabs>
          </>
        )}
      </CardContent>
    </Card>
  );
};

export default PoliticalEmojiAvatar;