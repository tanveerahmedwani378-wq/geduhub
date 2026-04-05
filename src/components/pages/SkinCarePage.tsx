import React, { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import { Label } from '@/components/ui/label';
import { Progress } from '@/components/ui/progress';
import { Droplets, Sun, Moon, Sparkles, Heart, ShieldCheck, ArrowLeft, ArrowRight, RotateCcw } from 'lucide-react';

const skinCareTopics = [
  {
    icon: Droplets,
    title: 'Hydration',
    description: 'Learn why hydration is the foundation of healthy skin and how to keep your skin moisturized.',
    tips: ['Drink 8 glasses of water daily', 'Use a hydrating serum with hyaluronic acid', 'Apply moisturizer on damp skin'],
  },
  {
    icon: Sun,
    title: 'Sun Protection',
    description: 'Understand SPF, UVA/UVB rays, and how to protect your skin from sun damage.',
    tips: ['Apply SPF 30+ sunscreen daily', 'Reapply every 2 hours outdoors', 'Wear hats and protective clothing'],
  },
  {
    icon: Moon,
    title: 'Night Routine',
    description: 'Build an effective nighttime skincare routine for skin repair and rejuvenation.',
    tips: ['Double cleanse to remove makeup', 'Use retinol or peptides at night', 'Apply a rich night cream'],
  },
  {
    icon: Sparkles,
    title: 'Acne Care',
    description: 'Tips and treatments for managing acne-prone skin effectively.',
    tips: ['Use salicylic acid or benzoyl peroxide', 'Avoid touching your face', 'Change pillowcases regularly'],
  },
  {
    icon: Heart,
    title: 'Natural Remedies',
    description: 'Explore natural and home-based skincare solutions using everyday ingredients.',
    tips: ['Aloe vera for soothing skin', 'Honey masks for hydration', 'Turmeric for brightening'],
  },
  {
    icon: ShieldCheck,
    title: 'Skin Barrier',
    description: 'Learn how to protect and repair your skin barrier for long-term skin health.',
    tips: ['Avoid over-exfoliating', 'Use ceramide-based products', 'Keep your routine simple'],
  },
];

const quizQuestions = [
  {
    question: 'How does your skin feel after washing your face?',
    options: [
      { label: 'Tight and dry', value: 'dry' },
      { label: 'Oily and shiny', value: 'oily' },
      { label: 'Normal and comfortable', value: 'normal' },
      { label: 'Dry in some areas, oily in others', value: 'combination' },
    ],
  },
  {
    question: 'How often do you experience breakouts?',
    options: [
      { label: 'Rarely', value: 'dry' },
      { label: 'Frequently, especially on forehead/nose', value: 'oily' },
      { label: 'Occasionally', value: 'normal' },
      { label: 'Mainly on chin and forehead', value: 'combination' },
    ],
  },
  {
    question: 'How does your skin react to new products?',
    options: [
      { label: 'Gets red, itchy, or irritated easily', value: 'sensitive' },
      { label: 'Usually fine, no reaction', value: 'normal' },
      { label: 'Sometimes breaks out', value: 'oily' },
      { label: 'Feels even drier', value: 'dry' },
    ],
  },
  {
    question: 'What does your skin look like by midday?',
    options: [
      { label: 'Flaky or patchy', value: 'dry' },
      { label: 'Very shiny all over', value: 'oily' },
      { label: 'Shiny only on nose/forehead', value: 'combination' },
      { label: 'Looks the same as morning', value: 'normal' },
    ],
  },
  {
    question: 'How visible are your pores?',
    options: [
      { label: 'Almost invisible', value: 'dry' },
      { label: 'Large and visible all over', value: 'oily' },
      { label: 'Visible only on nose/cheeks', value: 'combination' },
      { label: 'Small but visible', value: 'normal' },
    ],
  },
];

type SkinType = 'dry' | 'oily' | 'normal' | 'combination' | 'sensitive';

const routines: Record<SkinType, { title: string; icon: React.ElementType; description: string; morning: string[]; night: string[]; tips: string[] }> = {
  dry: {
    title: 'Dry Skin Routine',
    icon: Droplets,
    description: 'Your skin needs extra moisture and gentle care to stay hydrated and comfortable.',
    morning: ['Gentle cream cleanser', 'Hyaluronic acid serum', 'Rich moisturizer', 'SPF 30+ sunscreen'],
    night: ['Oil-based cleanser', 'Hydrating toner', 'Facial oil or overnight mask', 'Heavy night cream'],
    tips: ['Avoid hot water on face', 'Use a humidifier', 'Drink plenty of water', 'Avoid alcohol-based products'],
  },
  oily: {
    title: 'Oily Skin Routine',
    icon: Sparkles,
    description: 'Focus on balancing oil production without stripping your skin of natural moisture.',
    morning: ['Foaming or gel cleanser', 'Niacinamide serum', 'Oil-free moisturizer', 'Mattifying SPF'],
    night: ['Salicylic acid cleanser', 'BHA exfoliant (2-3x/week)', 'Lightweight gel moisturizer'],
    tips: ['Don\'t skip moisturizer', 'Use blotting papers midday', 'Avoid heavy oils', 'Clay mask weekly'],
  },
  normal: {
    title: 'Normal Skin Routine',
    icon: Heart,
    description: 'Lucky you! Maintain your balanced skin with a simple, consistent routine.',
    morning: ['Gentle cleanser', 'Vitamin C serum', 'Lightweight moisturizer', 'SPF 30+'],
    night: ['Micellar water or gentle cleanser', 'Retinol (2-3x/week)', 'Night moisturizer'],
    tips: ['Stay consistent', 'Protect from sun daily', 'Exfoliate 1-2x weekly', 'Stay hydrated'],
  },
  combination: {
    title: 'Combination Skin Routine',
    icon: Moon,
    description: 'Target different zones of your face with tailored products for the best results.',
    morning: ['Gentle gel cleanser', 'Niacinamide serum', 'Lightweight moisturizer (heavier on dry areas)', 'SPF 30+'],
    night: ['Double cleanse', 'AHA/BHA toner on T-zone', 'Hydrating serum on cheeks', 'Balanced moisturizer'],
    tips: ['Use different products for different zones', 'Don\'t over-cleanse', 'Multi-mask weekly', 'Balance is key'],
  },
  sensitive: {
    title: 'Sensitive Skin Routine',
    icon: ShieldCheck,
    description: 'Gentle, fragrance-free products are your best friend. Less is more!',
    morning: ['Fragrance-free cream cleanser', 'Centella or aloe serum', 'Barrier cream moisturizer', 'Mineral SPF'],
    night: ['Micellar water', 'Calming toner (chamomile/oat)', 'Ceramide moisturizer'],
    tips: ['Patch test new products', 'Avoid fragrances & essential oils', 'Keep routine minimal', 'Use lukewarm water'],
  },
};

interface SkinCarePageProps {
  onStartChat?: (topic: string) => void;
}

export const SkinCarePage: React.FC<SkinCarePageProps> = ({ onStartChat }) => {
  const [showQuiz, setShowQuiz] = useState(false);
  const [currentQ, setCurrentQ] = useState(0);
  const [answers, setAnswers] = useState<string[]>([]);
  const [currentAnswer, setCurrentAnswer] = useState('');
  const [result, setResult] = useState<SkinType | null>(null);

  const handleNext = () => {
    const newAnswers = [...answers];
    newAnswers[currentQ] = currentAnswer;
    setAnswers(newAnswers);

    if (currentQ < quizQuestions.length - 1) {
      setCurrentQ(currentQ + 1);
      setCurrentAnswer(newAnswers[currentQ + 1] || '');
    } else {
      // Calculate result
      const counts: Record<string, number> = {};
      newAnswers.forEach((a) => {
        counts[a] = (counts[a] || 0) + 1;
      });
      const skinType = Object.entries(counts).sort((a, b) => b[1] - a[1])[0][0] as SkinType;
      setResult(skinType);
    }
  };

  const handleBack = () => {
    if (currentQ > 0) {
      const newAnswers = [...answers];
      newAnswers[currentQ] = currentAnswer;
      setAnswers(newAnswers);
      setCurrentQ(currentQ - 1);
      setCurrentAnswer(newAnswers[currentQ - 1] || '');
    }
  };

  const resetQuiz = () => {
    setShowQuiz(false);
    setCurrentQ(0);
    setAnswers([]);
    setCurrentAnswer('');
    setResult(null);
  };

  const progress = result ? 100 : ((currentQ + (currentAnswer ? 0.5 : 0)) / quizQuestions.length) * 100;

  return (
    <div className="flex-1 p-6 overflow-y-auto">
      <div className="max-w-4xl mx-auto">
        <div className="mb-8">
          <h1 className="text-3xl font-bold text-foreground mb-2">Skin Care</h1>
          <p className="text-muted-foreground">
            Your guide to healthy, glowing skin. Explore tips, routines, and expert advice.
          </p>
        </div>

        {/* Quiz Section */}
        {!showQuiz && !result && (
          <Card className="mb-8 border-primary/20 bg-primary/5">
            <CardContent className="flex flex-col sm:flex-row items-center gap-4 p-6">
              <div className="p-3 rounded-full bg-primary/10">
                <Sparkles className="w-8 h-8 text-primary" />
              </div>
              <div className="flex-1 text-center sm:text-left">
                <h2 className="text-xl font-semibold text-foreground mb-1">Find Your Skin Type</h2>
                <p className="text-sm text-muted-foreground">Take a quick 5-question quiz to discover your skin type and get a personalized routine.</p>
              </div>
              <Button onClick={() => setShowQuiz(true)}>Start Quiz</Button>
            </CardContent>
          </Card>
        )}

        {showQuiz && !result && (
          <Card className="mb-8">
            <CardHeader className="pb-3">
              <div className="flex items-center justify-between mb-2">
                <CardTitle className="text-lg">Skin Type Quiz</CardTitle>
                <span className="text-sm text-muted-foreground">{currentQ + 1}/{quizQuestions.length}</span>
              </div>
              <Progress value={progress} className="h-2" />
            </CardHeader>
            <CardContent>
              <p className="font-medium text-foreground mb-4">{quizQuestions[currentQ].question}</p>
              <RadioGroup value={currentAnswer} onValueChange={setCurrentAnswer} className="space-y-3">
                {quizQuestions[currentQ].options.map((opt) => (
                  <div key={opt.label} className="flex items-center space-x-3 p-3 rounded-lg border hover:bg-accent/50 transition-colors cursor-pointer" onClick={() => setCurrentAnswer(opt.value)}>
                    <RadioGroupItem value={opt.value} id={opt.label} />
                    <Label htmlFor={opt.label} className="cursor-pointer flex-1">{opt.label}</Label>
                  </div>
                ))}
              </RadioGroup>
              <div className="flex justify-between mt-6">
                <Button variant="outline" onClick={currentQ === 0 ? resetQuiz : handleBack}>
                  <ArrowLeft className="w-4 h-4 mr-1" />
                  {currentQ === 0 ? 'Cancel' : 'Back'}
                </Button>
                <Button onClick={handleNext} disabled={!currentAnswer}>
                  {currentQ === quizQuestions.length - 1 ? 'See Results' : 'Next'}
                  <ArrowRight className="w-4 h-4 ml-1" />
                </Button>
              </div>
            </CardContent>
          </Card>
        )}

        {result && (
          <Card className="mb-8 border-primary/30">
            <CardHeader>
              <div className="flex items-center gap-3 mb-1">
                <div className="p-2 rounded-lg bg-primary/10">
                  {React.createElement(routines[result].icon, { className: 'w-6 h-6 text-primary' })}
                </div>
                <CardTitle className="text-xl">{routines[result].title}</CardTitle>
              </div>
              <CardDescription>{routines[result].description}</CardDescription>
            </CardHeader>
            <CardContent className="space-y-5">
              <div>
                <h3 className="font-semibold text-foreground flex items-center gap-2 mb-2"><Sun className="w-4 h-4 text-primary" /> Morning Routine</h3>
                <ol className="list-decimal list-inside space-y-1 text-sm text-muted-foreground">
                  {routines[result].morning.map((s, i) => <li key={i}>{s}</li>)}
                </ol>
              </div>
              <div>
                <h3 className="font-semibold text-foreground flex items-center gap-2 mb-2"><Moon className="w-4 h-4 text-primary" /> Night Routine</h3>
                <ol className="list-decimal list-inside space-y-1 text-sm text-muted-foreground">
                  {routines[result].night.map((s, i) => <li key={i}>{s}</li>)}
                </ol>
              </div>
              <div>
                <h3 className="font-semibold text-foreground flex items-center gap-2 mb-2"><Heart className="w-4 h-4 text-primary" /> Extra Tips</h3>
                <ul className="space-y-1 text-sm text-muted-foreground">
                  {routines[result].tips.map((t, i) => <li key={i} className="flex items-start gap-2"><span className="text-primary">•</span>{t}</li>)}
                </ul>
              </div>
              <Button variant="outline" onClick={resetQuiz} className="mt-2">
                <RotateCcw className="w-4 h-4 mr-1" /> Retake Quiz
              </Button>
            </CardContent>
          </Card>
        )}

        {/* Topic Cards */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {skinCareTopics.map((topic) => (
            <Card key={topic.title} className={`hover:shadow-md transition-shadow ${onStartChat ? 'cursor-pointer' : ''}`} onClick={() => onStartChat?.(`Tell me about ${topic.title.toLowerCase()} in skin care. ${topic.description}`)}>
              <CardHeader className="pb-3">
                <div className="flex items-center gap-3">
                  <div className="p-2 rounded-lg bg-primary/10">
                    <topic.icon className="w-5 h-5 text-primary" />
                  </div>
                  <div>
                    <CardTitle className="text-lg">{topic.title}</CardTitle>
                  </div>
                </div>
                <CardDescription>{topic.description}</CardDescription>
              </CardHeader>
              <CardContent>
                <ul className="space-y-1.5">
                  {topic.tips.map((tip, i) => (
                    <li key={i} className="flex items-start gap-2 text-sm text-muted-foreground">
                      <span className="text-primary mt-0.5">•</span>
                      {tip}
                    </li>
                  ))}
                </ul>
              </CardContent>
            </Card>
          ))}
        </div>
      </div>
    </div>
  );
};
