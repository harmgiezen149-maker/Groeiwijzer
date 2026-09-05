import { describe, expect, it } from 'vitest';
import { careTaskPatch, parseOrThrow, plantInput, plantPatch } from './validation';

describe('patch-schema', () => {
  it('vult bij een patch geen standaardwaarden in die niet zijn meegestuurd', () => {
    // Zonder deze regel zou een statuswijziging frostSensitive op false zetten
    // en kreeg een vorstgevoelige plant geen vorstwaarschuwing meer.
    const patch = parseOrThrow(plantPatch, { status: 'dood', statusReason: 'vorstschade' });
    expect(patch).toEqual({ status: 'dood', statusReason: 'vorstschade' });
    expect('frostSensitive' in patch).toBe(false);
    expect('quantity' in patch).toBe(false);
    expect('source' in patch).toBe(false);
  });

  it('laat een taakpatch alleen de meegestuurde velden zien', () => {
    const patch = parseOrThrow(careTaskPatch, { enabled: false });
    expect(patch).toEqual({ enabled: false });
  });

  it('vult bij aanmaken wél de standaardwaarden in', () => {
    const input = parseOrThrow(plantInput, {
      locationId: 'l1',
      commonName: 'Hortensia',
      category: 'struik',
    });
    expect(input.quantity).toBe(1);
    expect(input.frostSensitive).toBe(false);
    expect(input.source).toBe('handmatig');
  });

  it('houdt meegestuurde waarden vast', () => {
    const input = parseOrThrow(plantInput, {
      locationId: 'l1',
      commonName: 'Hortensia',
      category: 'struik',
      frostSensitive: true,
      quantity: 3,
    });
    expect(input.frostSensitive).toBe(true);
    expect(input.quantity).toBe(3);
  });

  it('weigert een onbekende categorie', () => {
    expect(() =>
      parseOrThrow(plantInput, { locationId: 'l1', commonName: 'X', category: 'ruimteschip' }),
    ).toThrow();
  });
});
