import pptxgen from 'pptxgenjs';

interface Slide {
  title: string;
  content: string[];
}

export function parseContentToSlides(content: string): Slide[] {
  const slides: Slide[] = [];
  const lines = content.split('\n').filter(line => line.trim());
  
  let currentSlide: Slide | null = null;
  
  for (const line of lines) {
    const trimmedLine = line.trim();
    
    // Detect headers (##, ###, or lines ending with :)
    if (trimmedLine.startsWith('## ') || trimmedLine.startsWith('### ') || 
        trimmedLine.startsWith('# ') || /^[A-Z].*:$/.test(trimmedLine)) {
      
      // Save previous slide
      if (currentSlide && (currentSlide.title || currentSlide.content.length > 0)) {
        slides.push(currentSlide);
      }
      
      // Start new slide
      const title = trimmedLine.replace(/^#{1,3}\s*/, '').replace(/:$/, '');
      currentSlide = { title, content: [] };
    } else if (currentSlide) {
      // Add bullet point content
      const bulletContent = trimmedLine
        .replace(/^[-*•]\s*/, '')  // Remove existing bullets
        .replace(/^\d+\.\s*/, ''); // Remove numbered list markers
      
      if (bulletContent) {
        currentSlide.content.push(bulletContent);
      }
    } else {
      // No current slide, create one with no title
      if (!currentSlide) {
        currentSlide = { title: '', content: [] };
      }
      const bulletContent = trimmedLine.replace(/^[-*•]\s*/, '').replace(/^\d+\.\s*/, '');
      if (bulletContent) {
        currentSlide.content.push(bulletContent);
      }
    }
  }
  
  // Add last slide
  if (currentSlide && (currentSlide.title || currentSlide.content.length > 0)) {
    slides.push(currentSlide);
  }
  
  // If no slides were created, create one with all content
  if (slides.length === 0) {
    slides.push({
      title: 'Presentation',
      content: lines.slice(0, 10),
    });
  }
  
  return slides;
}

export async function generatePresentation(content: string, filename: string = 'presentation'): Promise<void> {
  const pptx = new pptxgen();
  
  // Set presentation properties
  pptx.layout = 'LAYOUT_WIDE';
  pptx.title = filename;
  pptx.author = 'GEDUHub AI';
  
  // Define master slide colors
  const primaryColor = '7c3aed'; // Purple
  const textColor = '1f2937';
  const lightBg = 'f8fafc';
  
  const slides = parseContentToSlides(content);
  
  // Create title slide if first slide has a title
  if (slides.length > 0 && slides[0].title) {
    const titleSlide = pptx.addSlide();
    titleSlide.background = { color: primaryColor };
    
    titleSlide.addText(slides[0].title, {
      x: 0.5,
      y: 2,
      w: '90%',
      h: 1.5,
      fontSize: 44,
      bold: true,
      color: 'FFFFFF',
      align: 'center',
      fontFace: 'Arial',
    });
    
    if (slides[0].content.length > 0) {
      titleSlide.addText(slides[0].content[0], {
        x: 0.5,
        y: 3.5,
        w: '90%',
        h: 1,
        fontSize: 24,
        color: 'FFFFFF',
        align: 'center',
        fontFace: 'Arial',
      });
    }
    
    // Remove first slide from array since we used it as title
    slides.shift();
  }
  
  // Create content slides
  for (const slide of slides) {
    const pptSlide = pptx.addSlide();
    pptSlide.background = { color: lightBg };
    
    // Add title bar
    pptSlide.addShape('rect', {
      x: 0,
      y: 0,
      w: '100%',
      h: 1,
      fill: { color: primaryColor },
    });
    
    // Add slide title
    if (slide.title) {
      pptSlide.addText(slide.title, {
        x: 0.5,
        y: 0.2,
        w: '90%',
        h: 0.6,
        fontSize: 28,
        bold: true,
        color: 'FFFFFF',
        fontFace: 'Arial',
      });
    }
    
    // Add bullet points
    if (slide.content.length > 0) {
      const bulletPoints = slide.content.map(text => ({
        text,
        options: {
          bullet: { type: 'bullet' as const },
          fontSize: 18,
          color: textColor,
          breakLine: true,
        },
      }));
      
      pptSlide.addText(bulletPoints, {
        x: 0.5,
        y: 1.3,
        w: '90%',
        h: 4,
        fontFace: 'Arial',
        valign: 'top',
      });
    }
  }
  
  // If no content slides were added, create a single content slide
  if (slides.length === 0) {
    const slide = pptx.addSlide();
    slide.background = { color: lightBg };
    
    slide.addText(content.slice(0, 1000), {
      x: 0.5,
      y: 0.5,
      w: '90%',
      h: '90%',
      fontSize: 16,
      color: textColor,
      fontFace: 'Arial',
      valign: 'top',
    });
  }
  
  // Generate and download
  await pptx.writeFile({ fileName: `${filename}.pptx` });
}
