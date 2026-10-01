export const motionTokens = {
  fast: 0.16,
  normal: 0.24,
  slow: 0.34,
  ease: [0.22, 1, 0.36, 1] as const,
};
export const reveal = {
  initial: { opacity: 0, y: 8 },
  animate: { opacity: 1, y: 0 },
  exit: { opacity: 0, y: -6 },
  transition: { duration: motionTokens.normal, ease: motionTokens.ease },
};
