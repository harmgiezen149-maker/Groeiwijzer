import { describe, expect, it } from 'vitest';
import { hashPassword, verifyPassword, wachtwoordProbleem } from './password';

describe('wachtwoorden', () => {
  it('herkent het eigen wachtwoord en niets anders', async () => {
    const hash = await hashPassword('tuinvrouw-2026');
    expect(await verifyPassword('tuinvrouw-2026', hash)).toBe(true);
    expect(await verifyPassword('tuinvrouw-2027', hash)).toBe(false);
    expect(await verifyPassword('', hash)).toBe(false);
  });

  it('geeft elke keer een ander zout', async () => {
    const a = await hashPassword('tuinvrouw-2026');
    const b = await hashPassword('tuinvrouw-2026');
    expect(a).not.toBe(b);
    expect(await verifyPassword('tuinvrouw-2026', b)).toBe(true);
  });

  it('slikt geen rommel als opgeslagen waarde', async () => {
    expect(await verifyPassword('tuinvrouw-2026', 'onzin')).toBe(false);
    expect(await verifyPassword('tuinvrouw-2026', 'scrypt$1$2$3$vier$vijf')).toBe(false);
  });

  it('weigert te korte en te voor de hand liggende wachtwoorden', () => {
    expect(wachtwoordProbleem('kort')).toContain('minstens');
    expect(wachtwoordProbleem('wachtwoord123')).toContain('raden');
    expect(wachtwoordProbleem('marieke-tuin', 'marieke@voorbeeld.nl')).toContain('e-mailadres');
    expect(wachtwoordProbleem('hortensia in de voortuin')).toBeNull();
  });
});
