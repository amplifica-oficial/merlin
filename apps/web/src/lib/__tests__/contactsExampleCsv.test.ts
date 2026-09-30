import {describe, expect, it} from 'vitest';

import {CONTACTS_EXAMPLE_CSV_FILENAME, buildContactsExampleCsv} from '../contactsExampleCsv';

describe('buildContactsExampleCsv', () => {
  it('starts with a UTF-8 BOM and the expected header and rows', () => {
    const csv = buildContactsExampleCsv();

    expect(csv.startsWith('\uFEFF')).toBe(true);
    expect(csv).toContain('email,subscribed,firstName,lastName');
    expect(csv).toContain('jane@example.com,true,Jane,Doe');
    expect(csv).toContain('john@example.com,false,John,Smith');
    expect(CONTACTS_EXAMPLE_CSV_FILENAME).toBe('contacts-example.csv');
  });
});
