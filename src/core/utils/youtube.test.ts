import { describe, expect, it } from 'vitest';
import { extraerIdYoutube } from './youtube';

const ID = 'dQw4w9WgXcQ';

describe('extraerIdYoutube', () => {
  it.each([
    `https://www.youtube.com/watch?v=${ID}`,
    `https://youtube.com/watch?v=${ID}&t=42s&list=PL123`,
    `https://m.youtube.com/watch?v=${ID}`,
    `https://youtu.be/${ID}`,
    `https://youtu.be/${ID}?si=abc123&t=10`,
    `https://www.youtube.com/shorts/${ID}`,
    `https://www.youtube.com/embed/${ID}`,
    `https://www.youtube-nocookie.com/embed/${ID}?rel=0`,
    `https://www.youtube.com/live/${ID}`,
    `  https://youtu.be/${ID}  `,
  ])('reconoce %s', (enlace) => {
    expect(extraerIdYoutube(enlace)).toBe(ID);
  });

  it.each([
    '',
    'youtube',
    'https://vimeo.com/123456',
    `https://youtube.com.evil.com/watch?v=${ID}`,
    'https://www.youtube.com/watch?v=corto',
    'https://www.youtube.com/@canal',
    `javascript:alert("${ID}")`,
    `ftp://youtu.be/${ID}`,
  ])('rechaza %s', (enlace) => {
    expect(extraerIdYoutube(enlace)).toBeNull();
  });

  it('tolera null y undefined', () => {
    expect(extraerIdYoutube(null)).toBeNull();
    expect(extraerIdYoutube(undefined)).toBeNull();
  });
});
