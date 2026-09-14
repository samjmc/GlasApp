// Fallback to development placeholders when environment variables aren't available
/** Reads an environment variable from injected window config, falling back to an empty string. */
export const getEnvVar = (key: string): string => {
  // For client-side use
  if (typeof window !== 'undefined') {
    return (window as unknown).__ENV__?.[key] || '';
  }
  return '';
};

// OpenAI API configuration
/** OpenAI API key read from the runtime environment. */
export const OPENAI_API_KEY = getEnvVar('OPENAI_API_KEY');