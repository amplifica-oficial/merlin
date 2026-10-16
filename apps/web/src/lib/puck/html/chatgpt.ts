import {minifyHtml} from './minify';

export const CHATGPT_URL_MAX_LENGTH = 8000;

export const CHATGPT_DEFAULT_PROMPT = `You are an expert front-end developer. Below is the complete HTML of my landing page. I want to modify it.

Rules:
- Always reply with the FULL, complete HTML document in a single \`\`\`html code block (no partial snippets, no diffs).
- Plain HTML/CSS/JS only (CDN links are fine). No build steps or frameworks requiring compilation.
- Keep existing scripts, forms, tracking snippets, and external links working unless I ask otherwise.
- Keep image and asset URLs absolute.

If I haven't told you what to change yet, ask me first before modifying anything.`;

export const CHATGPT_CLIPBOARD_PROMPT =
  'Vou colar o HTML da minha landing page em seguida. Aguarde o HTML antes de sugerir mudanças.';

export type ChatGptOpenPlan = {mode: 'url'; url: string} | {mode: 'clipboard'; url: string; clipboardText: string};

export function chatGptUrl(prompt: string): string {
  const url = new URL('https://chatgpt.com/');
  url.searchParams.set('q', prompt);
  return url.toString();
}

export function planChatGptOpen(html: string, maxLength = CHATGPT_URL_MAX_LENGTH): ChatGptOpenPlan {
  const fullPrompt = `${CHATGPT_DEFAULT_PROMPT}\n\n\`\`\`html\n${minifyHtml(html)}\n\`\`\``;
  const fullUrl = chatGptUrl(fullPrompt);
  if (fullUrl.length <= maxLength) {
    return {mode: 'url', url: fullUrl};
  }

  return {
    mode: 'clipboard',
    url: chatGptUrl(CHATGPT_CLIPBOARD_PROMPT),
    clipboardText: fullPrompt,
  };
}
