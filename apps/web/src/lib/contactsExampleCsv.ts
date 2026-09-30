export const CONTACTS_EXAMPLE_CSV_FILENAME = 'contacts-example.csv';

const EXAMPLE_ROWS = [
  'email,subscribed,firstName,lastName',
  'jane@example.com,true,Jane,Doe',
  'john@example.com,false,John,Smith',
];

export function buildContactsExampleCsv(): string {
  return `\uFEFF${EXAMPLE_ROWS.join('\n')}\n`;
}

export function downloadContactsExampleCsv(): void {
  const blob = new Blob([buildContactsExampleCsv()], {type: 'text/csv;charset=utf-8'});
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = CONTACTS_EXAMPLE_CSV_FILENAME;
  link.click();
  URL.revokeObjectURL(url);
}
