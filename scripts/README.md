# Scripts

Utility scripts for local development and operational smoke tests. Run from the repository root unless noted otherwise.

## `generate-import-csv.sh`

Builds a CSV file ready for **Contacts → Import**, aimed at production/staging email verification.

Uses plus addressing so each test is a distinct Merlin contact but mail still arrives in one inbox:

| Base email | Suffix | Generated contact |
|------------|--------|-------------------|
| `diego@gmail.com` | `123` | `diego+123@gmail.com` |

### Quick start

```bash
yarn generate:import-csv --email diego@gmail.com --suffix 123
```

### All options

```
--email       Base inbox (required), no '+' in the address
--suffix      Plus-tag (default: test-<unix-ts>)
--count       Number of rows (default: 1)
--subscribed  true|false (default: true)
--first-name  firstName column (default: Test)
--output      Output path (default: contacts-import-<suffix>.csv)
--help        Show usage
```

### Output format

```csv
email,firstName,subscribed
diego+123@gmail.com,Test,true
```

Compatible with the contact import processor — see [Importing contacts from CSV](https://docs.merlin.example/guides/importing-contacts).

### Notes

- Output files matching `contacts-*.csv` are gitignored.
- Re-importing the same email updates the contact in place (no duplicate).
- Use a unique `--suffix` per test run to create a fresh contact.

See also [Getting Started — Generate import CSV for smoke tests](../GETTING_STARTED.md#generate-import-csv-for-smoke-tests).
