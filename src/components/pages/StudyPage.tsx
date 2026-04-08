import React from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import {
  BookOpen,
  Brain,
  Clock,
  RefreshCw,
  Target,
  Lightbulb,
  Calculator,
  FlaskConical,
  Globe,
  Languages,
  Palette,
  Code,
  MessageSquare,
} from 'lucide-react';

interface StudyPageProps {
  onStartChat: (topic: string) => void;
}

const studyTips = [
  {
    icon: Clock,
    title: 'Pomodoro Technique',
    description: 'Study in focused 25-minute intervals with 5-minute breaks to maximize concentration.',
    prompt: 'Tell me about the Pomodoro Technique for studying. How do I use it effectively, what are the best practices, and how can I adapt it for different subjects?',
  },
  {
    icon: Brain,
    title: 'Active Recall',
    description: 'Test yourself instead of re-reading. Retrieve information from memory to strengthen it.',
    prompt: 'Explain active recall as a study technique. How does it work, what are practical ways to implement it, and why is it more effective than passive review?',
  },
  {
    icon: RefreshCw,
    title: 'Spaced Repetition',
    description: 'Review material at increasing intervals to move knowledge into long-term memory.',
    prompt: 'Tell me about spaced repetition for studying. How do I create a spaced repetition schedule, what tools can I use, and how does it improve long-term retention?',
  },
  {
    icon: Target,
    title: 'Goal Setting',
    description: 'Set SMART study goals to stay motivated and track your academic progress.',
    prompt: 'Help me with study goal setting. How do I set SMART goals for studying, create a study plan, and stay motivated throughout the semester?',
  },
  {
    icon: Lightbulb,
    title: 'Mind Mapping',
    description: 'Visualize connections between concepts to deepen understanding and recall.',
    prompt: 'Explain mind mapping as a study technique. How do I create effective mind maps, what tools can I use, and which subjects benefit most from this approach?',
  },
  {
    icon: BookOpen,
    title: 'Note-Taking Methods',
    description: 'Master Cornell, outline, and charting methods for better lecture notes.',
    prompt: 'Tell me about effective note-taking methods for students. Compare Cornell notes, outline method, and charting method. Which works best for different types of classes?',
  },
];

const subjects = [
  { icon: Calculator, title: 'Mathematics', color: 'text-blue-500', prompt: 'I need help with Mathematics. Can you help me understand concepts, solve problems, or explain formulas?' },
  { icon: FlaskConical, title: 'Science', color: 'text-green-500', prompt: 'I need help with Science. Can you explain scientific concepts, help with experiments, or clarify theories?' },
  { icon: Globe, title: 'History', color: 'text-amber-500', prompt: 'I need help with History. Can you explain historical events, help me analyze causes and effects, or prepare for exams?' },
  { icon: Languages, title: 'English', color: 'text-purple-500', prompt: 'I need help with English. Can you help with grammar, essay writing, literature analysis, or vocabulary?' },
  { icon: Code, title: 'Computer Science', color: 'text-cyan-500', prompt: 'I need help with Computer Science. Can you explain programming concepts, help debug code, or teach algorithms?' },
  { icon: Palette, title: 'Arts', color: 'text-pink-500', prompt: 'I need help with Arts. Can you discuss art history, techniques, creative projects, or art analysis?' },
];

export const StudyPage: React.FC<StudyPageProps> = ({ onStartChat }) => {
  return (
    <div className="flex-1 overflow-y-auto p-4 md:p-6">
      <div className="max-w-4xl mx-auto space-y-8">
        {/* Header */}
        <div className="text-center space-y-2">
          <h1 className="text-2xl md:text-3xl font-bold text-foreground flex items-center justify-center gap-2">
            <BookOpen className="w-7 h-7 text-primary" />
            Study Hub
          </h1>
          <p className="text-muted-foreground">Study techniques & subject help — click any card to start chatting</p>
        </div>

        {/* Study Techniques */}
        <section className="space-y-4">
          <h2 className="text-lg font-semibold text-foreground">📚 Study Techniques</h2>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {studyTips.map((tip) => (
              <Card
                key={tip.title}
                className="cursor-pointer hover:shadow-lg transition-all duration-200 hover:scale-[1.02] border-border"
                onClick={() => onStartChat(tip.prompt)}
              >
                <CardHeader className="pb-2">
                  <CardTitle className="flex items-center gap-2 text-base">
                    <tip.icon className="w-5 h-5 text-primary" />
                    {tip.title}
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <p className="text-sm text-muted-foreground">{tip.description}</p>
                </CardContent>
              </Card>
            ))}
          </div>
        </section>

        {/* Subject Help */}
        <section className="space-y-4">
          <h2 className="text-lg font-semibold text-foreground">🎓 Get Subject Help</h2>
          <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
            {subjects.map((subject) => (
              <Button
                key={subject.title}
                variant="outline"
                className="h-auto py-4 flex flex-col items-center gap-2 hover:bg-accent/50 transition-all"
                onClick={() => onStartChat(subject.prompt)}
              >
                <subject.icon className={`w-6 h-6 ${subject.color}`} />
                <span className="text-sm font-medium">{subject.title}</span>
              </Button>
            ))}
          </div>
        </section>

        {/* Quick Chat */}
        <Card className="border-primary/20 bg-gradient-to-br from-primary/5 to-accent/5">
          <CardContent className="p-4 flex items-center gap-3">
            <MessageSquare className="w-5 h-5 text-primary shrink-0" />
            <div className="flex-1">
              <p className="text-sm font-medium text-foreground">Need help with something else?</p>
              <p className="text-xs text-muted-foreground">Go to Chat and ask anything!</p>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
};
