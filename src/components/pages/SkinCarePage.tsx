import React from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Droplets, Sun, Moon, Sparkles, Heart, ShieldCheck } from 'lucide-react';

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

export const SkinCarePage: React.FC = () => {
  return (
    <div className="flex-1 p-6 overflow-y-auto">
      <div className="max-w-4xl mx-auto">
        <div className="mb-8">
          <h1 className="text-3xl font-bold text-foreground mb-2">Skin Care</h1>
          <p className="text-muted-foreground">
            Your guide to healthy, glowing skin. Explore tips, routines, and expert advice.
          </p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {skinCareTopics.map((topic) => (
            <Card key={topic.title} className="hover:shadow-md transition-shadow">
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
