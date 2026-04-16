import JSZip from 'jszip';

export interface SlideContent {
  id: number;
  text: string[];
}

export async function parsePptx(file: File): Promise<SlideContent[]> {
  const zip = await JSZip.loadAsync(file);
  const slideFiles = Object.keys(zip.files).filter(name => name.startsWith('ppt/slides/slide') && name.endsWith('.xml'));
  
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
      const textNodes = xmlDoc.getElementsByTagName('a:t');
      const text: string[] = [];
      for (let i = 0; i < textNodes.length; i++) {
        const val = textNodes[i].textContent;
        if (val) text.push(val);
      }
      
      const slideId = parseInt(slideFile.match(/slide(\d+)\.xml/)?.[1] || '0');
      slides.push({ id: slideId, text });
    }
  }

  return slides;
}
