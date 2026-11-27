/**
 * Price integrity for Building Innovation.
 *
 * BI sells the same list as UNITEC, which is stored in COP. The USD figure must be derived
 * from a rate and rounded UP, so an approximate quote never undercuts the list price, and a
 * missing price must never become a number.
 */
import { describe, it, expect } from 'vitest';
// @ts-ignore — plain ESM module
import { parseCop, copToUsd, priceForBrand } from '../api/brand-packs.js';

describe('COP parsing', () => {
  it('reads the Colombian list format', () => {
    expect(parseCop('$ 27.000')).toBe(27000);
    expect(parseCop('78.000')).toBe(78000);
    expect(parseCop('$ 1.234,50')).toBe(1234.5);
  });

  it('returns null instead of guessing', () => {
    expect(parseCop('Consultar precio')).toBeNull();
    expect(parseCop('')).toBeNull();
    expect(parseCop(undefined)).toBeNull();
    expect(parseCop('$ 0')).toBeNull();
  });
});

describe('COP -> USD', () => {
  it('converts at the given rate, rounded up to the cent', () => {
    // 27.000 COP at 3.577,08 COP/USD = 7.5484 USD -> 7.55 (never 7.54)
    expect(copToUsd('$ 27.000', 3577.08)).toBe(7.55);
    expect(copToUsd('$ 27.000', 4000)).toBe(6.75);
  });

  it('refuses to price without a usable rate', () => {
    expect(copToUsd('$ 27.000', 0)).toBeNull();
    expect(copToUsd('$ 27.000', null)).toBeNull();
    expect(copToUsd('Consultar precio', 3577)).toBeNull();
  });

  it('never returns a USD list price for a product that only has a placeholder', () => {
    expect(priceForBrand({ price_usd: 'Consultar precio', price_cop: '$ 27.000' }, 'building')).toBe('');
    expect(priceForBrand({ price_usd: '', price_cop: '$ 27.000' }, 'building')).toBe('');
    expect(priceForBrand({ price_usd: '$9.99', price_cop: '$ 27.000' }, 'building')).toBe('$9.99');
  });
});
