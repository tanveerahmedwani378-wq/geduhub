import React from 'react';
import { Video, Film, Clapperboard, Camera, Palette, Music, Wand2, Layers } from 'lucide-react';

interface VideoPageProps {
  onStartChat: (topic: string) => void;
}

const videoTopics = [
  { icon: Film, title: 'Video Editing Tips', desc: 'Learn cuts, transitions & effects', gradient: 'from-purple-500/20 to-violet-500/20', border: 'hover:border-purple-400/50', prompt: 'Give me professional video editing tips and techniques. Cover cuts, transitions, color grading, and pacing for creating engaging videos.' },
  { icon: Clapperboard, title: 'Script Writing', desc: 'Write compelling video scripts', gradient: 'from-blue-500/20 to-cyan-500/20', border: 'hover:border-blue-400/50', prompt: 'Help me write a compelling video script. Teach me about hooks, storytelling structure, and how to keep viewers engaged throughout the video.' },
  { icon: Camera, title: 'Camera & Shooting', desc: 'Framing, angles & lighting', gradient: 'from-amber-500/20 to-orange-500/20', border: 'hover:border-amber-400/50', prompt: 'Teach me about camera techniques for video making. Cover framing, angles, camera movements, and lighting setups for professional-looking videos.' },
  { icon: Palette, title: 'Thumbnails & Design', desc: 'Eye-catching visual design', gradient: 'from-pink-500/20 to-rose-500/20', border: 'hover:border-pink-400/50', prompt: 'Help me create eye-catching video thumbnails and visual designs. Cover color theory, typography, composition, and tools for thumbnail creation.' },
  { icon: Music, title: 'Audio & Music', desc: 'Sound design & background music', gradient: 'from-emerald-500/20 to-teal-500/20', border: 'hover:border-emerald-400/50', prompt: 'Guide me on audio and music for videos. Cover background music selection, sound effects, voiceover recording tips, and audio mixing basics.' },
  { icon: Wand2, title: 'AI Video Tools', desc: 'AI-powered video creation', gradient: 'from-indigo-500/20 to-purple-500/20', border: 'hover:border-indigo-400/50', prompt: 'Tell me about AI-powered video creation tools and techniques. Cover AI video generators, AI editing assistants, text-to-video tools, and how to use them effectively.' },
  { icon: Layers, title: 'Motion Graphics', desc: 'Animations & visual effects', gradient: 'from-cyan-500/20 to-sky-500/20', border: 'hover:border-cyan-400/50', prompt: 'Teach me about motion graphics and visual effects for videos. Cover animation principles, text animations, lower thirds, intros/outros, and tools to create them.' },
  { icon: Video, title: 'YouTube & Social', desc: 'Grow your video presence', gradient: 'from-red-500/20 to-orange-500/20', border: 'hover:border-red-400/50', prompt: 'Help me grow my YouTube channel and social media video presence. Cover SEO, content strategy, posting schedules, engagement tactics, and analytics.' },
];

export const VideoPage: React.FC<VideoPageProps> = ({ onStartChat }) => {
  return (
    <div className="flex-1 overflow-y-auto p-4 md:p-8">
      <div className="max-w-4xl mx-auto">
        <div className="text-center mb-8">
          <div className="inline-flex items-center justify-center w-16 h-16 rounded-2xl bg-gradient-to-br from-red-500/20 to-orange-500/20 mb-4">
            <Video className="w-8 h-8 text-red-400" />
          </div>
          <h1 className="text-3xl md:text-4xl font-bold text-foreground mb-2">Video Making Hub</h1>
          <p className="text-muted-foreground text-lg">Learn video creation, editing, and grow your content</p>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          {videoTopics.map((topic, i) => {
            const Icon = topic.icon;
            return (
              <div
                key={i}
                onClick={() => onStartChat(topic.prompt)}
                className={`p-5 rounded-2xl bg-gradient-to-br ${topic.gradient} backdrop-blur-sm border border-border/50 ${topic.border} transition-all duration-300 cursor-pointer group text-center hover:scale-105 hover:shadow-lg`}
              >
                <div className="flex justify-center mb-3">
                  <Icon className="w-8 h-8 text-foreground group-hover:scale-110 transition-transform duration-300" />
                </div>
                <h3 className="font-semibold text-foreground group-hover:text-primary transition-colors">{topic.title}</h3>
                <p className="text-xs text-muted-foreground mt-1">{topic.desc}</p>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
};
