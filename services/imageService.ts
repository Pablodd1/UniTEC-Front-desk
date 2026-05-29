const getApiBaseUrl = () => {
  if (typeof window !== 'undefined') {
    if (window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1') {
      return 'http://localhost:3000';
    }
  }
  return 'https://unitecusadesign.com';
};

export const generateImage = async (prompt: string, aspectRatio: "1:1" | "3:4" | "4:3" | "9:16" | "16:9" = "1:1") => {
    try {
        const apiBaseUrl = getApiBaseUrl();
        const response = await fetch(`${apiBaseUrl}/API/ai/chat`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                model: 'gemini-3.1-flash-image-preview',
                contents: [{ parts: [{ text: prompt }] }],
                config: {
                    imageConfig: {
                        aspectRatio: aspectRatio,
                        imageSize: "1K"
                    }
                }
            })
        });

        if (!response.ok) {
            throw new Error(`Image proxy error: ${response.statusText}`);
        }

        const data = await response.json();
        for (const part of data.candidates?.[0]?.content?.parts || []) {
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
        const apiBaseUrl = getApiBaseUrl();
        const cleanBase64 = base64Image.replace(/^data:image\/\w+;base64,/, "");
        
        const response = await fetch(`${apiBaseUrl}/API/ai/chat`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                model: 'gemini-3.1-flash-image-preview',
                contents: [
                    {
                        parts: [
                            {
                                inlineData: {
                                    data: cleanBase64,
                                    mimeType: mimeType
                                }
                            },
                            {
                                text: prompt
                            }
                        ]
                    }
                ]
            })
        });

        if (!response.ok) {
            throw new Error(`Image edit proxy error: ${response.statusText}`);
        }

        const data = await response.json();
        for (const part of data.candidates?.[0]?.content?.parts || []) {
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
