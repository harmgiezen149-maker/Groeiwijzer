import { describe, expect, it } from 'vitest';
import { imageOf, isPrivateAddress, stripHtml, titleOf } from './url-import';

/**
 * De foto van een productpagina: webwinkels zetten die in og:image. Alleen
 * publieke http(s)-adressen tellen mee (§13).
 */

const BASIS = 'https://kwekerij.nl/planten/hortensia';

describe('foto van een pagina', () => {
  it('pakt og:image en maakt er een volledig adres van', () => {
    const html = `<meta property="og:image" content="/media/hortensia.jpg">`;
    expect(imageOf(html, BASIS)).toBe('https://kwekerij.nl/media/hortensia.jpg');
  });

  it('valt terug op twitter:image', () => {
    const html = `<meta name="twitter:image" content="https://cdn.kwekerij.nl/h.jpg">`;
    expect(imageOf(html, BASIS)).toBe('https://cdn.kwekerij.nl/h.jpg');
  });

  it('slaat logo’s en pictogrammen over', () => {
    const html = `
      <img src="/assets/logo.svg" alt="Logo">
      <img src="/icons/cart.png" alt="Winkelwagen">
      <img src="/media/hortensia-groot.jpg" alt="Hortensia in bloei">
    `;
    expect(imageOf(html, BASIS)).toBe('https://kwekerij.nl/media/hortensia-groot.jpg');
  });

  it('weigert wat geen http of https is', () => {
    expect(imageOf(`<meta property="og:image" content="data:image/png;base64,AAA">`, BASIS)).toBe(
      undefined,
    );
    expect(imageOf('<p>geen foto</p>', BASIS)).toBe(undefined);
  });

  it('blijft de rest van de pagina gewoon lezen', () => {
    const html = '<title>Hortensia kopen</title><p>Snoei in maart.</p>';
    expect(titleOf(html)).toBe('Hortensia kopen');
    expect(stripHtml(html)).toContain('Snoei in maart.');
  });

  it('houdt privé-adressen buiten de deur', () => {
    expect(isPrivateAddress('192.168.1.4')).toBe(true);
    expect(isPrivateAddress('127.0.0.1')).toBe(true);
    expect(isPrivateAddress('kwekerij.nl')).toBe(false);
  });
});
