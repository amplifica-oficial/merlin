// @vitest-environment happy-dom

import {describe, expect, it} from 'vitest';

import {findPropMatches} from '../prop-match';

describe('findPropMatches', () => {
  it('finds nested array text paths', () => {
    const matches = findPropMatches(
      {
        testimonials: [
          {text: 'Great', name: 'Ana'},
          {text: 'Love it', name: 'Bia'},
        ],
      },
      ['Love it'],
    );
    expect(matches).toEqual(['testimonials.1.text']);
  });

  it('matches src and href strings', () => {
    const matches = findPropMatches({imageSrc: 'https://cdn.example/a.png', href: '/go'}, [
      'https://cdn.example/a.png',
    ]);
    expect(matches).toContain('imageSrc');
  });
});
