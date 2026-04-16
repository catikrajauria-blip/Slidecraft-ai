import pptxgen from "pptxgenjs";
import { Project } from "@/types";

export async function exportToPptx(project: Project) {
  const pptx = new pptxgen();

  pptx.layout = "LAYOUT_16x9";

  project.slides.forEach((slide) => {
    const pptxSlide = pptx.addSlide();
    
    // Set background color
    pptxSlide.background = { fill: slide.theme.secondaryColor };

    // Add title
    pptxSlide.addText(slide.title, {
      x: 0.5,
      y: 0.5,
      w: "90%",
      h: 1,
      fontSize: 36,
      bold: true,
      color: slide.theme.primaryColor,
      fontFace: slide.theme.fontFamily,
      align: "left",
    });

    // Add content
    pptxSlide.addText(slide.content, {
      x: 0.5,
      y: 1.5,
      w: "90%",
      h: 3,
      fontSize: 18,
      color: slide.theme.primaryColor,
      fontFace: slide.theme.fontFamily,
      align: "left",
      valign: "top",
    });

    // Add footer with visual suggestion
    pptxSlide.addText(slide.visualSuggestion, {
      x: 0.5,
      y: 5,
      w: "90%",
      h: 0.5,
      fontSize: 10,
      italic: true,
      color: slide.theme.accentColor,
      align: "right",
    });
  });

  await pptx.writeFile({ fileName: `${project.name}.pptx` });
}
