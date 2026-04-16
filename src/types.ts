export interface EnhancedSlide {
  title: string;
  content: string;
  visualSuggestion: string;
  animationType: string;
  theme: {
    primaryColor: string;
    secondaryColor: string;
    accentColor: string;
    fontFamily: string;
  };
}

export interface Project {
  id: string;
  name: string;
  createdAt: number;
  slides: EnhancedSlide[];
  originalText: string;
}

export interface ChatMessage {
  role: 'user' | 'model';
  content: string;
}
