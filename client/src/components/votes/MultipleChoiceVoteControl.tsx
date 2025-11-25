import { Button } from "@/components/ui/button";
import { motion, AnimatePresence } from "framer-motion";
import { Check } from "lucide-react";
import { useState } from "react";

interface MultipleChoiceVoteControlProps {
  options: Record<string, string>; // { option_a: "Text", option_b: "Text", ... }
  selectedOption: string | null;
  onSelect: (optionKey: string) => void;
  disabled?: boolean;
}

// Emoji mapping for different option positions and content types
const getOptionEmoji = (index: number, optionText: string): string => {
  const text = optionText.toLowerCase();
  
  // Content-based emojis
  if (text.includes('privacy') || text.includes('protect') || text.includes('rights')) return '🔒';
  if (text.includes('transparency') || text.includes('open') || text.includes('public')) return '👁️';
  if (text.includes('community') || text.includes('families') || text.includes('people')) return '👥';
  if (text.includes('strict') || text.includes('guidelines') || text.includes('oversight')) return '📋';
  if (text.includes('health') || text.includes('medical') || text.includes('hospital')) return '🏥';
  if (text.includes('education') || text.includes('school') || text.includes('learn')) return '📚';
  if (text.includes('housing') || text.includes('home') || text.includes('accommodation')) return '🏠';
  if (text.includes('economy') || text.includes('economic') || text.includes('financial')) return '💰';
  if (text.includes('environment') || text.includes('climate') || text.includes('green')) return '🌱';
  if (text.includes('security') || text.includes('safety') || text.includes('protect')) return '🛡️';
  if (text.includes('freedom') || text.includes('liberty') || text.includes('choice')) return '🕊️';
  if (text.includes('support') || text.includes('help') || text.includes('assist')) return '🤝';
  if (text.includes('reform') || text.includes('change') || text.includes('improve')) return '⚡';
  if (text.includes('maintain') || text.includes('keep') || text.includes('current')) return '⚖️';
  
  // Position-based fallback emojis
  const positionEmojis = ['✨', '💡', '🎯', '🚀'];
  return positionEmojis[index % positionEmojis.length];
};

export function MultipleChoiceVoteControl({
  options,
  selectedOption,
  onSelect,
  disabled = false,
}: MultipleChoiceVoteControlProps) {
  const [hoveredOption, setHoveredOption] = useState<string | null>(null);
  const optionEntries = Object.entries(options).sort(([a], [b]) => {
    // Sort by option key (option_a, option_b, option_c, option_d)
    return a.localeCompare(b);
  });

  return (
    <div className="space-y-2 w-full">
      {optionEntries.map(([optionKey, optionText], index) => {
        const isSelected = selectedOption === optionKey;
        const isHovered = hoveredOption === optionKey;
        const emoji = getOptionEmoji(index, optionText);
        
        return (
          <motion.div
            key={optionKey}
            initial={{ opacity: 0, y: 10, scale: 0.98 }}
            animate={{ 
              opacity: 1, 
              y: 0, 
              scale: 1,
            }}
            transition={{ 
              delay: index * 0.05,
              type: "spring",
              stiffness: 300,
              damping: 25
            }}
            className="w-full"
            onHoverStart={() => !disabled && setHoveredOption(optionKey)}
            onHoverEnd={() => setHoveredOption(null)}
          >
            <motion.div
              animate={{
                scale: isSelected ? 1.01 : 1,
                y: isSelected ? -1 : 0,
              }}
              transition={{
                type: "spring",
                stiffness: 400,
                damping: 25
              }}
            >
              <Button
                type="button"
                variant={isSelected ? "default" : "outline"}
                className={`
                  w-full justify-start text-left h-auto py-2.5 px-3
                  min-w-0 relative overflow-hidden
                  ${isSelected 
                    ? "bg-gradient-to-r from-emerald-600 to-emerald-500 hover:from-emerald-700 hover:to-emerald-600 border-emerald-400 text-white shadow-lg shadow-emerald-500/30" 
                    : "bg-black/40 hover:bg-black/60 border-slate-700 text-slate-200 hover:text-white hover:border-slate-600"
                  }
                  transition-all duration-200
                  ${disabled ? "opacity-50 cursor-not-allowed" : "cursor-pointer"}
                `}
                onClick={() => {
                  if (!disabled) {
                    // Haptic feedback for mobile devices
                    if (navigator.vibrate) {
                      navigator.vibrate(50);
                    }
                    onSelect(optionKey);
                  }
                }}
                disabled={disabled}
              >

                <div className="flex items-start gap-2 w-full min-w-0 relative z-10">
                  {/* Emoji */}
                  <motion.span
                    animate={{
                      scale: isSelected ? 1.1 : 1,
                    }}
                    transition={{ duration: 0.2 }}
                    className="text-lg flex-shrink-0"
                  >
                    {emoji}
                  </motion.span>

                  {/* Check mark */}
                  <AnimatePresence>
                    {isSelected && (
                      <motion.div
                        initial={{ scale: 0 }}
                        animate={{ scale: 1 }}
                        exit={{ scale: 0 }}
                        transition={{ type: "spring", stiffness: 500, damping: 20 }}
                        className="flex-shrink-0"
                      >
                        <Check className="w-4 h-4 text-white" />
                      </motion.div>
                    )}
                  </AnimatePresence>

                  {!isSelected && (
                    <div className="w-4 h-4 rounded-full border-2 border-slate-600 flex-shrink-0" />
                  )}

                  {/* Text */}
                  <span className="flex-1 text-xs sm:text-sm font-medium leading-snug break-words whitespace-normal min-w-0">
                    {optionText}
                  </span>
                </div>
              </Button>
            </motion.div>
          </motion.div>
        );
      })}
    </div>
  );
}

