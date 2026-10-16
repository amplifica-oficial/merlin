const PROTECTED_TAG = /<(pre|textarea|script|style)\b[^>]*>[\s\S]*?<\/\1>/gi;

export function minifyHtml(html: string): string {
  const protectedBlocks: string[] = [];
  const shielded = html.replace(PROTECTED_TAG, match => {
    const token = `\u0000${protectedBlocks.length}\u0000`;
    protectedBlocks.push(match);
    return token;
  });

  const minified = shielded
    .replace(/<!--[\s\S]*?-->/g, '')
    .replace(/>\s+</g, '><')
    .replace(/[ \t]{2,}/g, ' ')
    .trim();

  return minified.replace(/\u0000(\d+)\u0000/g, (_, index: string) => protectedBlocks[Number(index)] ?? '');
}
