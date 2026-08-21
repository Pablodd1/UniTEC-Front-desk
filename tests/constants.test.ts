import { describe, it, expect } from 'vitest';
import { getSystemInstruction } from '../constants';

describe('Constants & Chatbot System Prompt Training', () => {
  it('should include installation disclaimer script in system prompt', () => {
    const prompt = getSystemInstruction('es', undefined, 'unitec');
    expect(prompt).toContain('distribución mas no instalación');
    expect(prompt).toContain('contacto de una persona externa');
  });

  it('should include WhatsApp redirect number for human/price inquiries', () => {
    const prompt = getSystemInstruction('es', undefined, 'unitec');
    // The system prompt must point the customer to the WhatsApp sales line.
    // Assert on the wa.me link and the official number (both are what the app
    // actually emits; the '*' style is a masking artifact, never a literal).
    expect(prompt).toContain('https://wa.me/573142332147');
    expect(prompt).toMatch(/573142332147/);
  });

  it('should include the 7 required profession options in the prompt', () => {
    const prompt = getSystemInstruction('es', undefined, 'unitec');
    expect(prompt).toContain('1. Arquitecto');
    expect(prompt).toContain('2. Constructor');
    expect(prompt).toContain('3. Diseñador');
    expect(prompt).toContain('4. Distribuidor');
    expect(prompt).toContain('5. Mayorista');
    expect(prompt).toContain('6. Cliente Final');
    expect(prompt).toContain('7. Otro');
  });
});
