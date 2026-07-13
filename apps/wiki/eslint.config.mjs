import config from '@merlin/eslint-config/next';

const wikiConfig = [
  ...config,
  {
    ignores: ['.source/**'],
  },
];

export default wikiConfig;
