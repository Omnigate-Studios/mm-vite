export const stripAsterisks = (text: string): string => {
  return text
    .replace(/\*[^*]*\*/g, '')
    .replace(/\s+/g, ' ')
    .trim();
};
