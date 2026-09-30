import {describe, expect, it} from 'vitest';

import {
  landingImageRadiusPreset,
  landingImageWidthIsFull,
  resolveLandingImageLayout,
} from '../landingImageLayout';

describe('resolveLandingImageLayout', () => {
  it('defaults omitted width to full parent width with no column constraints', () => {
    const layout = resolveLandingImageLayout();

    expect(layout.wrapperClass).toBe('w-full');
    expect(layout.wrapperClass).not.toMatch(/max-w-/);
    expect(layout.wrapperClass).not.toMatch(/\bpx-/);
    expect(layout.imgClass.split(' ')).toEqual(expect.arrayContaining(['h-auto', 'bg-transparent', 'rounded-xl']));
    expect(layout.imgClass).not.toMatch(/mr-auto|mx-auto|ml-auto/);
    expect(layout.imgStyle).toEqual({width: '100%'});
    expect(layout.wrapperStyle).toEqual({backgroundColor: 'transparent'});
  });

  it('keeps the wrapper full-bleed while sizing and aligning the image', () => {
    expect(resolveLandingImageLayout('50', 'left')).toEqual({
      wrapperClass: 'w-full',
      wrapperStyle: {backgroundColor: 'transparent'},
      imgClass: 'block h-auto bg-transparent mr-auto rounded-xl',
      imgStyle: {width: '50%'},
    });
    expect(resolveLandingImageLayout('50', 'center')).toEqual({
      wrapperClass: 'w-full',
      wrapperStyle: {backgroundColor: 'transparent'},
      imgClass: 'block h-auto bg-transparent mx-auto rounded-xl',
      imgStyle: {width: '50%'},
    });
    expect(resolveLandingImageLayout('50', 'right')).toEqual({
      wrapperClass: 'w-full',
      wrapperStyle: {backgroundColor: 'transparent'},
      imgClass: 'block h-auto bg-transparent ml-auto rounded-xl',
      imgStyle: {width: '50%'},
    });
  });

  it('ignores align when the image is full width', () => {
    expect(resolveLandingImageLayout('100', 'left').imgClass).not.toMatch(/mr-auto|mx-auto|ml-auto/);
    expect(resolveLandingImageLayout('100', 'left').imgStyle).toEqual({width: '100%'});
  });

  it('applies arbitrary percent widths', () => {
    expect(resolveLandingImageLayout('40', 'center')).toEqual({
      wrapperClass: 'w-full',
      wrapperStyle: {backgroundColor: 'transparent'},
      imgClass: 'block h-auto bg-transparent mx-auto rounded-xl',
      imgStyle: {width: '40%'},
    });
    expect(resolveLandingImageLayout('33%', 'right')).toEqual({
      wrapperClass: 'w-full',
      wrapperStyle: {backgroundColor: 'transparent'},
      imgClass: 'block h-auto bg-transparent ml-auto rounded-xl',
      imgStyle: {width: '33%'},
    });
  });

  it('defaults invalid or out-of-range widths to full parent', () => {
    expect(resolveLandingImageLayout('nope').imgStyle).toEqual({width: '100%'});
    expect(resolveLandingImageLayout('0').imgStyle).toEqual({width: '100%'});
    expect(resolveLandingImageLayout('150').imgStyle).toEqual({width: '100%'});
  });

  it('maps square and none to no radius', () => {
    expect(resolveLandingImageLayout('100', 'center', false).imgClass).not.toMatch(/rounded/);
    expect(resolveLandingImageLayout('100', 'center', 'none').imgClass).not.toMatch(/rounded/);
    expect(resolveLandingImageLayout('100', 'center', 'none').imgStyle).toEqual({width: '100%'});
  });

  it('maps named radius presets to tailwind classes', () => {
    expect(resolveLandingImageLayout('100', 'center', true).imgClass.split(' ')).toContain('rounded-xl');
    expect(resolveLandingImageLayout('100', 'center', 'sm').imgClass.split(' ')).toContain('rounded-sm');
    expect(resolveLandingImageLayout('100', 'center', 'full').imgClass.split(' ')).toContain('rounded-full');
  });

  it('applies custom pixel radius without preset classes', () => {
    expect(resolveLandingImageLayout('50', 'left', '24')).toEqual({
      wrapperClass: 'w-full',
      wrapperStyle: {backgroundColor: 'transparent'},
      imgClass: 'block h-auto bg-transparent mr-auto',
      imgStyle: {width: '50%', borderRadius: '24px'},
    });
    expect(resolveLandingImageLayout('50', 'left', '16px').imgStyle).toEqual({
      width: '50%',
      borderRadius: '16px',
    });
  });
});

describe('landingImageWidthIsFull', () => {
  it('treats omitted, 100, and invalid as full width', () => {
    expect(landingImageWidthIsFull()).toBe(true);
    expect(landingImageWidthIsFull('100')).toBe(true);
    expect(landingImageWidthIsFull('100%')).toBe(true);
    expect(landingImageWidthIsFull('40')).toBe(false);
  });
});

describe('image background', () => {
  it('paints leftover space with a hex color while keeping the image itself transparent', () => {
    expect(resolveLandingImageLayout('50', 'center', 'xl', '#2563eb')).toEqual({
      wrapperClass: 'w-full',
      wrapperStyle: {backgroundColor: '#2563eb'},
      imgClass: 'block h-auto bg-transparent mx-auto rounded-xl',
      imgStyle: {width: '50%'},
    });
  });

  it('keeps the wrapper transparent so PNG alpha and leftover space show the section behind', () => {
    expect(resolveLandingImageLayout('50', 'left', 'none', 'transparent').wrapperStyle).toEqual({
      backgroundColor: 'transparent',
    });
    expect(resolveLandingImageLayout('50', 'left', 'none', 'transparent').imgClass).toContain('bg-transparent');
    expect(resolveLandingImageLayout('50', 'left', 'none', 'transparent').imgStyle).not.toHaveProperty(
      'backgroundColor',
    );
  });

  it('treats omitted or invalid background as transparent', () => {
    expect(resolveLandingImageLayout('100', 'center', 'xl').wrapperStyle).toEqual({
      backgroundColor: 'transparent',
    });
    expect(resolveLandingImageLayout('100', 'center', 'xl', 'red').wrapperStyle).toEqual({
      backgroundColor: 'transparent',
    });
  });
});

describe('landingImageRadiusPreset', () => {
  it('classifies boolean, named, and custom radius values', () => {
    expect(landingImageRadiusPreset()).toBe('xl');
    expect(landingImageRadiusPreset(true)).toBe('xl');
    expect(landingImageRadiusPreset(false)).toBe('none');
    expect(landingImageRadiusPreset('full')).toBe('full');
    expect(landingImageRadiusPreset('24')).toBe('custom');
  });
});
