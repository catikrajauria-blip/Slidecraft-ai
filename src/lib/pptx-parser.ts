import JSZip from 'jszip';

export interface SlideContent {
  id: number;
  text: string[];
}

export async function parsePptx(file: File): Promise<SlideContent[]> {
  try {
    const zip = await JSZip.loadAsync(file);
    const slideFiles = Object.keys(zip.files).filter(name => 
      (name.startsWith('ppt/slides/slide') || name.startsWith('ppt/slides/slide')) && 
      name.endsWith('.xml')
    );
    
    if (slideFiles.length === 0) {
      console.warn("No slides found in PPTX structure. Checking alternative paths...");
    }

    // Sort slides by number
    slideFiles.sort((a, b) => {
      const numA = parseInt(a.match(/slide(\d+)\.xml/)?.[1] || '0');
      const numB = parseInt(b.match(/slide(\d+)\.xml/)?.[1] || '0');
      return numA - numB;
    });

    const slides: SlideContent[] = [];

    for (const slideFile of slideFiles) {
      const content = await zip.file(slideFile)?.async('text');
      if (content) {
        const parser = new DOMParser();
        const xmlDoc = parser.parseFromString(content, 'text/xml');
        
        // Try multiple ways to find text nodes
        let textNodes = xmlDoc.getElementsByTagName('a:t');
        if (textNodes.length === 0) {
          textNodes = xmlDoc.getElementsByTagName('t');
        }
        
        const text: string[] = [];
        for (let i = 0; i < textNodes.length; i++) {
          const val = textNodes[i].textContent;
          if (val && val.trim()) text.push(val.trim());
        }
        
        const slideId = parseInt(slideFile.match(/slide(\d+)\.xml/)?.[1] || '0');
        if (text.length > 0) {
          slides.push({ id: slideId, text });
        }
      }
    }

    return slides;
  } catch (error) {
    console.error("Error parsing PPTX:", error);
    throw new Error("The file could not be parsed. Please ensure it is a valid .pptx file.");
  }
}
