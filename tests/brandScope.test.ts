/**
 * Panel brand-scope contract.
 *
 * What this protects: the admin panel is shared by two companies. An operator must never see
 * one company's conversation, alert or metric while the header says the other. These are the
 * exact rules AdminDashboard / RecentAlerts use, tested with mixed fixtures.
 *
 * Run: npx vitest run tests/brandScope.test.ts
 */
import { describe, it, expect } from 'vitest';
import { themeFor, sessionBrand, filterByBrand, alertBrand } from '../brandTheme';

const sessions = [
  { id: 'u1', brandId: 'unitec', lastMessage: 'precio del piso deck' },
  { id: 'u2', brandId: 'unitec', lastMessage: '¿tienen stock en Medellín?' },
  { id: 'b1', brandId: 'building', lastMessage: 'price for pvc panel?' },
  { id: 'b2', brandId: 'building', lastMessage: 'do you install in Miami?' },
  { id: 'legacy', lastMessage: 'hola' }, // pre-brand row
];

describe('brand scope', () => {
  it('tags legacy rows as UNITEC, never as building', () => {
    expect(sessionBrand(sessions[4])).toBe('unitec');
    expect(sessionBrand({ brandId: 'building' })).toBe('building');
  });

  it('filters conversations with zero leakage in both directions', () => {
    const un = filterByBrand(sessions, 'unitec');
    const bi = filterByBrand(sessions, 'building');
    expect(un.map((s) => s.id)).toEqual(['u1', 'u2', 'legacy']);
    expect(bi.map((s) => s.id)).toEqual(['b1', 'b2']);
    // no session may appear in both lists, and the union is the whole set
    expect(un.filter((s) => bi.some((b) => b.id === s.id))).toHaveLength(0);
    expect(un.length + bi.length).toBe(sessions.length);
  });

  it('assigns each alert to its own company, not to the visible one', () => {
    expect(alertBrand({ sessionId: 'b1' }, sessions)).toBe('building');
    expect(alertBrand({ sessionId: 'u1' }, sessions)).toBe('unitec');
    // escalation's own brand field wins when the session is gone
    expect(alertBrand({ sessionId: 'gone', brand: 'building' }, sessions)).toBe('building');
    // unknown attribution falls back to UNITEC (legacy), so it can never pollute the Miami panel
    expect(alertBrand({ sessionId: 'gone' }, sessions)).toBe('unitec');
  });

  it('gives each company a distinct, correct identity in the header', () => {
    const un = themeFor('unitec');
    const bi = themeFor('building');
    expect(un.label).toBe('UNITEC USA DESIGN');
    expect(bi.label).toBe('BUILDING INNOVATION');
    expect(un.currency).toBe('COP');
    expect(bi.currency).toBe('USD');
    expect(un.language).toBe('es');
    expect(bi.language).toBe('en');
    expect(un.accent).not.toBe(bi.accent);
  });
});
