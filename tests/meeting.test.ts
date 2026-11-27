/**
 * Virtual-meeting flow: English (Building Innovation) acceptance + phone capture,
 * and Spanish (UNITEC) behaviour unchanged.
 *
 * Run: npx vitest run tests/meeting.test.ts
 */
import { describe, it, expect } from 'vitest';
// @ts-ignore — plain ESM module
import { detectMeetingAcceptance, extractPhone, shouldCapturePhone, MEETING_QUESTION, MEETING_QUESTION_EN } from '../api/_meeting.js';

describe('MEETING_QUESTION_EN (exact, verbatim)', () => {
  it('carries the exact English question', () => {
    expect(MEETING_QUESTION_EN).toBe(
      'Would you like to schedule a presentation of our portfolio and commercial terms for distributors?'
    );
  });
  it('leaves the Spanish question untouched', () => {
    expect(MEETING_QUESTION).toBe(
      '¿Te gustaría agendar una presentación de nuestro portafolio y condiciones comerciales para distribuidores?'
    );
  });
});

describe('English acceptance (building)', () => {
  const yes = ['yes', 'sure', 'sounds good', "I'm interested", 'let\'s schedule', 'schedule it', 'when can we', 'of course', 'absolutely'];
  it.each(yes)('accepts %s', (t) => {
    expect(detectMeetingAcceptance(t, 'building')).toBe(true);
  });

  const no = ['but', 'not now', 'later', 'no thanks', 'not interested', 'sure, but not now', 'yes but I need more info'];
  it.each(no)('rejects hedge %s', (t) => {
    expect(detectMeetingAcceptance(t, 'building')).toBe(false);
  });
});

describe('Spanish acceptance (unitec) unchanged', () => {
  it('still accepts Spanish affirmations', () => {
    expect(detectMeetingAcceptance('claro que sí', 'unitec')).toBe(true);
    expect(detectMeetingAcceptance('sí', 'unitec')).toBe(true);
    expect(detectMeetingAcceptance('me interesa', 'unitec')).toBe(true);
  });
  it('still rejects Spanish hedges', () => {
    expect(detectMeetingAcceptance('sí, pero no por ahora', 'unitec')).toBe(false);
    expect(detectMeetingAcceptance('no gracias', 'unitec')).toBe(false);
  });
  it('defaults to Spanish when brand is omitted', () => {
    expect(detectMeetingAcceptance('sí')).toBe(true);
    expect(detectMeetingAcceptance('yes', 'building')).toBe(true);
  });
});

describe('extractPhone', () => {
  it('extracts US numbers for building (10 digits + optional +1)', () => {
    expect(extractPhone('786-968-5783', 'building')).toBe('+17869685783');
    expect(extractPhone('1 (786) 968-5783', 'building')).toBe('+17869685783');
    expect(extractPhone('+1 786 968 5783', 'building')).toBe('+17869685783');
  });
  it('does NOT misclassify a 10-digit "3…" as Colombian for building', () => {
    // A US number whose area code starts with 3 (e.g. 314…) is still US for BI.
    expect(extractPhone('314 555 0199', 'building')).toBe('+13145550199');
  });
  it('keeps Colombian rules for unitec', () => {
    expect(extractPhone('314 233 2147', 'unitec')).toBe('+573142332147');
    expect(extractPhone('+57 314 233 2147', 'unitec')).toBe('+573142332147');
    expect(extractPhone('57 314 233 2147', 'unitec')).toBe('+573142332147');
  });
  it('never invents a number from junk', () => {
    expect(extractPhone('no phone here', 'building')).toBeNull();
    expect(extractPhone('123', 'building')).toBeNull();
    expect(extractPhone('', 'building')).toBeNull();
  });
});

describe('shouldCapturePhone', () => {
  it('captures inside the meeting flow regardless of language', () => {
    expect(shouldCapturePhone('786-968-5783', { meetingStatus: 'requested' })).toBe(true);
    expect(shouldCapturePhone('786-968-5783', { meetingRequested: true })).toBe(true);
  });
  it('captures with English phone signals', () => {
    expect(shouldCapturePhone('my number is 786-968-5783', {})).toBe(true);
    expect(shouldCapturePhone('call me at 786-968-5783', {})).toBe(true);
  });
});
