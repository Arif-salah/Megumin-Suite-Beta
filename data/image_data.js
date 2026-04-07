export const KAZUMA_PLACEHOLDERS = [
        { key: '"%prompt%"', desc: "Positive Prompt (Text)" },
        { key: '"%negative_prompt%"', desc: "Negative Prompt (Text)" },
        { key: '"%seed%"', desc: "Seed (Integer)" },
        { key: '"%steps%"', desc: "Sampling Steps (Integer)" },
        { key: '"%scale%"', desc: "CFG Scale (Float)" },
        { key: '"%denoise%"', desc: "Denoise Strength (Float)" },
        { key: '"%clip_skip%"', desc: "CLIP Skip (Integer)" },
        { key: '"%model%"', desc: "Checkpoint Name" },
        { key: '"%sampler%"', desc: "Sampler Name" },
        { key: '"%width%"', desc: "Image Width (px)" },
        { key: '"%height%"', desc: "Image Height (px)" },
        { key: '"%lora1%"', desc: "LoRA 1 Filename" },
        { key: '"%lorawt1%"', desc: "LoRA 1 Weight (Float)" },
        { key: '"%lora2%"', desc: "LoRA 2 Filename" },
        { key: '"%lorawt2%"', desc: "LoRA 2 Weight (Float)" },
        { key: '"%lora3%"', desc: "LoRA 3 Filename" },
        { key: '"%lorawt3%"', desc: "LoRA 3 Weight (Float)" },
        { key: '"%lora4%"', desc: "LoRA 4 Filename" },
        { key: '"%lorawt4%"', desc: "LoRA 4 Weight (Float)" }
    ];
    
export const RESOLUTIONS =[
        { label: "1024 x 1024 (SDXL 1:1)", w: 1024, h: 1024 },
        { label: "1152 x 896 (SDXL Landscape)", w: 1152, h: 896 },
        { label: "896 x 1152 (SDXL Portrait)", w: 896, h: 1152 },
        { label: "1216 x 832 (SDXL Landscape)", w: 1216, h: 832 },
        { label: "832 x 1216 (SDXL Portrait)", w: 832, h: 1216 },
        { label: "1344 x 768 (SDXL Landscape)", w: 1344, h: 768 },
        { label: "768 x 1344 (SDXL Portrait)", w: 768, h: 1344 },
        { label: "512 x 512 (SD 1.5 1:1)", w: 512, h: 512 },
        { label: "768 x 512 (SD 1.5 Landscape)", w: 768, h: 512 },
        { label: "512 x 768 (SD 1.5 Portrait)", w: 512, h: 768 },
    ];