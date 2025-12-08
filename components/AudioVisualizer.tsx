import React, { useRef, useEffect } from 'react';

interface AudioVisualizerProps {
  audioData: Uint8Array;
  isActive: boolean;
}

const AudioVisualizer: React.FC<AudioVisualizerProps> = ({ audioData, isActive }) => {
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const draw = () => {
      const width = canvas.width;
      const height = canvas.height;

      ctx.clearRect(0, 0, width, height);

      if (!isActive) {
        // Draw a flat line or gentle idle wave
        ctx.beginPath();
        ctx.strokeStyle = '#e2e8f0'; // gray-200
        ctx.lineWidth = 2;
        ctx.moveTo(0, height / 2);
        ctx.lineTo(width, height / 2);
        ctx.stroke();
        return;
      }

      const barWidth = (width / audioData.length) * 2.5;
      let x = 0;

      for (let i = 0; i < audioData.length; i++) {
        // Normalize 0-255 to 0-height
        const barHeight = (audioData[i] / 255) * height * 1.5; 

        // Gradient color based on height/intensity
        const gradient = ctx.createLinearGradient(0, height - barHeight, 0, height);
        gradient.addColorStop(0, '#0ea5e9'); // brand-500
        gradient.addColorStop(1, '#f59e0b'); // accent-500

        ctx.fillStyle = gradient;
        
        // Draw centered bar
        const y = (height - barHeight) / 2;
        
        // Rounded caps aesthetic
        ctx.beginPath();
        ctx.roundRect(x, y, barWidth - 2, barHeight, 4);
        ctx.fill();

        x += barWidth;
      }
    };

    requestAnimationFrame(draw);
  }, [audioData, isActive]);

  return (
    <canvas 
      ref={canvasRef} 
      width={300} 
      height={100} 
      className="w-full max-w-[300px] h-[100px]"
    />
  );
};

export default AudioVisualizer;
