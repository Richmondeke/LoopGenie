
export const generatePollinationsImage = async (prompt: string, width: number, height: number, seed?: string): Promise<string> => {
    const finalSeed = seed || Math.floor(Math.random() * 1000000).toString();
    const encodedPrompt = encodeURIComponent(prompt);
    
    // Pollinations URL structure
    const url = `https://image.pollinations.ai/prompt/${encodedPrompt}?width=${width}&height=${height}&seed=${finalSeed}&nologo=true&model=flux`;
    
    try {
        // We fetch the image to convert it to a Base64 Data URI.
        // This ensures consistent handling in the frontend (Editor preview) and FFMPEG service.
        const response = await fetch(url);
        if (!response.ok) throw new Error("Pollinations API request failed");

        const blob = await response.blob();
        return new Promise((resolve, reject) => {
            const reader = new FileReader();
            reader.onloadend = () => resolve(reader.result as string);
            reader.onerror = reject;
            reader.readAsDataURL(blob);
        });
    } catch (error) {
        console.error("Pollinations generation failed:", error);
        throw error;
    }
};
