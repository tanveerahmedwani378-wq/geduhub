import React, { useState } from 'react';
import { Plus, Trash2, Film, Image, Type, Download, Loader2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { toast } from 'sonner';
import { createSlideshowVideo, downloadVideo, SlideData } from '@/lib/videoCompiler';

const bgColors = [
  { label: 'Dark Blue', value: '#1a1a2e' },
  { label: 'Deep Purple', value: '#16213e' },
  { label: 'Forest Green', value: '#1b4332' },
  { label: 'Burgundy', value: '#3c1518' },
  { label: 'Charcoal', value: '#2d3436' },
  { label: 'Navy', value: '#0a1628' },
];

export const SlideshowMaker: React.FC = () => {
  const [slides, setSlides] = useState<SlideData[]>([
    { type: 'text', content: 'Your Title Here', backgroundColor: '#1a1a2e', textColor: '#ffffff', duration: 3 },
  ]);
  const [isGenerating, setIsGenerating] = useState(false);
  const [progress, setProgress] = useState(0);

  const addTextSlide = () => {
    setSlides(prev => [...prev, {
      type: 'text',
      content: 'New Slide',
      backgroundColor: bgColors[prev.length % bgColors.length].value,
      textColor: '#ffffff',
      duration: 3,
    }]);
  };

  const addImageSlide = () => {
    const input = document.createElement('input');
    input.type = 'file';
    input.accept = 'image/*';
    input.onchange = (e) => {
      const file = (e.target as HTMLInputElement).files?.[0];
      if (file) {
        const url = URL.createObjectURL(file);
        setSlides(prev => [...prev, {
          type: 'image',
          content: url,
          duration: 3,
        }]);
      }
    };
    input.click();
  };

  const updateSlide = (index: number, updates: Partial<SlideData>) => {
    setSlides(prev => prev.map((s, i) => i === index ? { ...s, ...updates } : s));
  };

  const removeSlide = (index: number) => {
    if (slides.length <= 1) {
      toast.error('Need at least one slide');
      return;
    }
    setSlides(prev => prev.filter((_, i) => i !== index));
  };

  const generateVideo = async () => {
    if (slides.length === 0) {
      toast.error('Add at least one slide');
      return;
    }

    setIsGenerating(true);
    setProgress(0);

    try {
      const blob = await createSlideshowVideo(slides, setProgress);
      downloadVideo(blob, 'slideshow-video.webm');
      toast.success('Video downloaded! 🎬');
    } catch (err) {
      console.error('Video generation error:', err);
      toast.error('Failed to generate video. Please try again.');
    } finally {
      setIsGenerating(false);
      setProgress(0);
    }
  };

  return (
    <div className="mt-8 p-6 rounded-2xl bg-gradient-to-br from-secondary/50 to-secondary/30 border border-border/50">
      <div className="flex items-center gap-3 mb-6">
        <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-primary/20 to-accent/20 flex items-center justify-center">
          <Film className="w-5 h-5 text-primary" />
        </div>
        <div>
          <h2 className="text-xl font-bold text-foreground">Slideshow Video Maker</h2>
          <p className="text-sm text-muted-foreground">Create videos from text and images</p>
        </div>
      </div>

      {/* Slides list */}
      <div className="space-y-3 mb-6">
        {slides.map((slide, index) => (
          <div
            key={index}
            className="flex items-start gap-3 p-4 rounded-xl bg-background/80 border border-border/50"
          >
            <div className="flex items-center justify-center w-8 h-8 rounded-lg bg-muted text-sm font-bold text-muted-foreground shrink-0">
              {index + 1}
            </div>

            <div className="flex-1 space-y-2">
              {slide.type === 'text' ? (
                <>
                  <Textarea
                    value={slide.content}
                    onChange={(e) => updateSlide(index, { content: e.target.value })}
                    placeholder="Slide text..."
                    className="min-h-[60px] text-sm"
                  />
                  <div className="flex flex-wrap gap-2">
                    {bgColors.map((color) => (
                      <button
                        key={color.value}
                        onClick={() => updateSlide(index, { backgroundColor: color.value })}
                        className={`w-6 h-6 rounded-full border-2 transition-transform ${
                          slide.backgroundColor === color.value ? 'border-primary scale-125' : 'border-transparent'
                        }`}
                        style={{ backgroundColor: color.value }}
                        title={color.label}
                      />
                    ))}
                  </div>
                </>
              ) : (
                <div className="flex items-center gap-2">
                  <Image className="w-4 h-4 text-muted-foreground" />
                  <span className="text-sm text-muted-foreground">Image slide</span>
                  {slide.content && (
                    <img src={slide.content} alt="Slide preview" className="w-16 h-10 rounded object-cover" />
                  )}
                </div>
              )}

              <div className="flex items-center gap-2">
                <span className="text-xs text-muted-foreground">Duration:</span>
                <Input
                  type="number"
                  min={1}
                  max={15}
                  value={slide.duration}
                  onChange={(e) => updateSlide(index, { duration: parseInt(e.target.value) || 3 })}
                  className="w-16 h-7 text-xs"
                />
                <span className="text-xs text-muted-foreground">sec</span>
              </div>
            </div>

            <Button
              variant="ghost"
              size="sm"
              onClick={() => removeSlide(index)}
              className="shrink-0 text-muted-foreground hover:text-destructive"
            >
              <Trash2 className="w-4 h-4" />
            </Button>
          </div>
        ))}
      </div>

      {/* Add slide buttons */}
      <div className="flex flex-wrap gap-2 mb-6">
        <Button variant="outline" size="sm" onClick={addTextSlide} className="gap-2">
          <Type className="w-4 h-4" />
          Add Text Slide
        </Button>
        <Button variant="outline" size="sm" onClick={addImageSlide} className="gap-2">
          <Image className="w-4 h-4" />
          Add Image Slide
        </Button>
      </div>

      {/* Generate button */}
      <Button
        onClick={generateVideo}
        disabled={isGenerating || slides.length === 0}
        className="w-full gap-2 bg-gradient-to-r from-primary to-accent hover:from-primary/90 hover:to-accent/90 text-primary-foreground"
        size="lg"
      >
        {isGenerating ? (
          <>
            <Loader2 className="w-5 h-5 animate-spin" />
            Generating... {progress}%
          </>
        ) : (
          <>
            <Download className="w-5 h-5" />
            Generate & Download Video
          </>
        )}
      </Button>
    </div>
  );
};
