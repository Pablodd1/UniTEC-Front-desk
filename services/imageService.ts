
import { GoogleGenAI } from "@google/genai";

const getAI = () => {
    const apiKey = process.env.GEMINI_API_KEY;
    if (!apiKey) {
        throw new Error("GEMINI_API_KEY is not set");
    }
    return new GoogleGenAI({ apiKey });
};

export const generateImage = async (prompt: string, aspectRatio: "1:1" | "3:4" | "4:3" | "9:16" | "16:9" = "1:1") => {
    try {
        const ai = getAI();
        const response = await ai.models.generateContent({
            model: 'gemini-3.1-flash-image-preview',
            contents: {
                parts: [
                    {
                        text: prompt,
                    },
                ],
            },
            config: {
                imageConfig: {
                    aspectRatio: aspectRatio,
                    imageSize: "1K"
                },
            },
        });

        for (const part of response.candidates?.[0]?.content?.parts || []) {
            if (part.inlineData) {
                const base64EncodeString = part.inlineData.data;
                return `data:image/png;base64,${base64EncodeString}`;
            }
        }
        return null;
    } catch (error) {
        console.error("Error generating image:", error);
        throw error;
    }
};

export const editImage = async (prompt: string, base64Image: string, mimeType: string = "image/png") => {
    try {
        const ai = getAI();
        // Remove data:image/png;base64, prefix if present
        const cleanBase64 = base64Image.replace(/^data:image\/\w+;base64,/, "");
        
        const response = await ai.models.generateContent({
            model: 'gemini-3.1-flash-image-preview',
            contents: {
                parts: [
                    {
                        inlineData: {
                            data: cleanBase64,
                            mimeType: mimeType,
                        },
                    },
                    {
                        text: prompt,
                    },
                ],
            },
        });

        for (const part of response.candidates?.[0]?.content?.parts || []) {
            if (part.inlineData) {
                const base64EncodeString = part.inlineData.data;
                return `data:image/png;base64,${base64EncodeString}`;
            }
        }
        return null;
    } catch (error) {
        console.error("Error editing image:", error);
        throw error;
    }
};
