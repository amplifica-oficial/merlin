import {visit} from 'unist-util-visit';

// Default URLs that will be replaced at container startup by sed
const API_URL = process.env.NEXT_PUBLIC_API_URI || 'https://next-api.merlin.example';
const DASHBOARD_URL = process.env.NEXT_PUBLIC_DASHBOARD_URI || 'https://next-app.merlin.example';

export function remarkReplaceEnv() {
  return tree => {
    visit(tree, ['code', 'inlineCode', 'text', 'link'], node => {
      // Replace in text values
      if (node.value && typeof node.value === 'string') {
        node.value = node.value.replace(/\{\{API_URL\}\}/g, API_URL).replace(/\{\{DASHBOARD_URL\}\}/g, DASHBOARD_URL);
      }

      // Replace in link URLs
      if (node.url && typeof node.url === 'string') {
        node.url = node.url.replace(/\{\{API_URL\}\}/g, API_URL).replace(/\{\{DASHBOARD_URL\}\}/g, DASHBOARD_URL);
      }
    });
  };
}
