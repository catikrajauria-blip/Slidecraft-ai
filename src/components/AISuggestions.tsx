import { useState, useEffect } from 'react';
import { motion } from 'motion/react';
import { Lightbulb, ArrowRight } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';

interface AISuggestionsProps {
  onApply: (suggestion: string) => void;
}

const SUGGESTIONS = [
  "Use a more vibrant color palette for the title slides.",
  "Simplify the bullet points on slide 3 for better readability.",
  "Add a 'Key Takeaways' slide at the end of the presentation.",
  "Use a dark theme for the entire presentation to make it look more premium.",
  "Add more icons to represent the core concepts in the introduction."
];

export function AISuggestions({ onApply }: AISuggestionsProps) {
  const [currentSuggestion, setCurrentSuggestion] = useState(SUGGESTIONS[0]);

  useEffect(() => {
    const interval = setInterval(() => {
      setCurrentSuggestion(SUGGESTIONS[Math.floor(Math.random() * SUGGESTIONS.length)]);
    }, 10000);
    return () => clearInterval(interval);
  }, []);

  return (
    <Card className="p-5 bg-accent/5 border-accent/20 rounded-2xl">
      <div className="flex items-start gap-4">
        <div className="w-10 h-10 bg-accent rounded-lg flex items-center justify-center shrink-0 neon-glow">
          <Lightbulb className="text-background w-5 h-5" />
        </div>
        <div className="flex-1">
          <p className="text-[10px] font-bold text-accent uppercase tracking-[0.2em] mb-2">Neural Insight</p>
          <p className="text-xs text-foreground/70 mb-4 leading-relaxed">{currentSuggestion}</p>
          <Button 
            variant="link" 
            size="sm" 
            className="p-0 h-auto text-accent hover:text-accent/80 gap-2 uppercase tracking-widest text-[10px] font-bold"
            onClick={() => onApply(currentSuggestion)}
          >
            Execute Parameter <ArrowRight className="w-3 h-3" />
          </Button>
        </div>
      </div>
    </Card>
  );
}
