// Fallback to development placeholders when environment variables aren't available
export const getEnvVar = (key: string): string => {
  // For client-side use
  if (typeof window !== 'undefined') {
    return (window as any).__ENV__?.[key] || '';
  }
  return '';
};

// OpenAI API configuration
export const OPENAI_API_KEY = getEnvVar('OPENAI_API_KEY');