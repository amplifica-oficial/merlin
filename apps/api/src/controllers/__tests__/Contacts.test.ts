import {describe, expect, it} from 'vitest';
import {parseDoubleOptInFlag} from '../Contacts.js';

describe('parseDoubleOptInFlag', () => {
  describe('truthy values', () => {
    it.each(['true', 'TRUE', '1', 'yes', ' YES '])('parses %j as true', value => {
      expect(parseDoubleOptInFlag(value)).toBe(true);
    });
  });

  describe('falsy values', () => {
    it.each(['false', '0', 'no', ''])('parses %j as false', value => {
      expect(parseDoubleOptInFlag(value)).toBe(false);
    });

    it('parses undefined as false', () => {
      expect(parseDoubleOptInFlag(undefined)).toBe(false);
    });

    it('parses null as false', () => {
      expect(parseDoubleOptInFlag(null)).toBe(false);
    });
  });

  describe('invalid values', () => {
    it.each(['si', 'maybe'])('returns invalid for %j', value => {
      expect(parseDoubleOptInFlag(value)).toBe('invalid');
    });

    it('returns invalid for non-string values (e.g. repeated multipart fields)', () => {
      expect(parseDoubleOptInFlag(['true', 'false'])).toBe('invalid');
    });
  });
});
