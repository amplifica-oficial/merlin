export const FORM_COLOR_TOKEN_KEYS = [
  'formBackgroundColor',
  'titleColor',
  'descriptionColor',
  'labelColor',
  'inputBackgroundColor',
  'inputBorderColor',
  'inputTextColor',
  'inputPlaceholderColor',
  'successColor',
  'errorColor',
  'buttonColor',
  'buttonTextColor',
] as const;

export type FormColorTokenKey = (typeof FORM_COLOR_TOKEN_KEYS)[number];

export type FormColorTokens = Record<FormColorTokenKey, string>;

export type FormColorThemeId = 'default' | 'dark' | 'slate' | 'ocean';

export const FORM_APPEARANCE_DEFAULTS: FormColorTokens = {
  formBackgroundColor: '#ffffff',
  titleColor: '#171717',
  descriptionColor: '#737373',
  labelColor: '#171717',
  inputBackgroundColor: '#ffffff',
  inputBorderColor: '#e5e5e5',
  inputTextColor: '#171717',
  inputPlaceholderColor: '#737373',
  successColor: '#16a34a',
  errorColor: '#ef4444',
  buttonColor: '#171717',
  buttonTextColor: '#fafafa',
};

export const FORM_COLOR_THEMES = {
  default: {
    id: 'default',
    label: 'Default',
    ...FORM_APPEARANCE_DEFAULTS,
  },
  dark: {
    id: 'dark',
    label: 'Dark',
    formBackgroundColor: '#0a0a0a',
    titleColor: '#fafafa',
    descriptionColor: '#a3a3a3',
    labelColor: '#e5e5e5',
    inputBackgroundColor: '#171717',
    inputBorderColor: '#404040',
    inputTextColor: '#fafafa',
    inputPlaceholderColor: '#737373',
    successColor: '#4ade80',
    errorColor: '#f87171',
    buttonColor: '#fafafa',
    buttonTextColor: '#171717',
  },
  slate: {
    id: 'slate',
    label: 'Slate',
    formBackgroundColor: '#f8fafc',
    titleColor: '#0f172a',
    descriptionColor: '#64748b',
    labelColor: '#1e293b',
    inputBackgroundColor: '#ffffff',
    inputBorderColor: '#cbd5e1',
    inputTextColor: '#0f172a',
    inputPlaceholderColor: '#94a3b8',
    successColor: '#059669',
    errorColor: '#dc2626',
    buttonColor: '#0f172a',
    buttonTextColor: '#f8fafc',
  },
  ocean: {
    id: 'ocean',
    label: 'Ocean',
    formBackgroundColor: '#f0f9ff',
    titleColor: '#0c4a6e',
    descriptionColor: '#0369a1',
    labelColor: '#075985',
    inputBackgroundColor: '#ffffff',
    inputBorderColor: '#7dd3fc',
    inputTextColor: '#0c4a6e',
    inputPlaceholderColor: '#38bdf8',
    successColor: '#0d9488',
    errorColor: '#e11d48',
    buttonColor: '#0284c7',
    buttonTextColor: '#ffffff',
  },
} as const satisfies Record<
  FormColorThemeId,
  {id: FormColorThemeId; label: string} & FormColorTokens
>;

export const FORM_COLOR_THEME_LIST = [
  FORM_COLOR_THEMES.default,
  FORM_COLOR_THEMES.dark,
  FORM_COLOR_THEMES.slate,
  FORM_COLOR_THEMES.ocean,
] as const;

export const FORM_COLOR_TOKEN_FIELDS: Array<{key: FormColorTokenKey; label: string}> = [
  {key: 'formBackgroundColor', label: 'Form background'},
  {key: 'titleColor', label: 'Title'},
  {key: 'descriptionColor', label: 'Description'},
  {key: 'labelColor', label: 'Labels'},
  {key: 'inputBackgroundColor', label: 'Input background'},
  {key: 'inputBorderColor', label: 'Input border'},
  {key: 'inputTextColor', label: 'Input text'},
  {key: 'inputPlaceholderColor', label: 'Placeholder'},
  {key: 'successColor', label: 'Success'},
  {key: 'errorColor', label: 'Error'},
  {key: 'buttonTextColor', label: 'Button text color'},
  {key: 'buttonColor', label: 'Button color'},
];

export function applyFormColorTheme(id: FormColorThemeId): FormColorTokens & {themeId: FormColorThemeId} {
  const theme = FORM_COLOR_THEMES[id];
  const tokens = FORM_COLOR_TOKEN_KEYS.reduce((acc, key) => {
    acc[key] = theme[key];
    return acc;
  }, {} as FormColorTokens);

  return {...tokens, themeId: id};
}
