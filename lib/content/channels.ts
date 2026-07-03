// Single source for channel display names (previously redefined in the
// calendar, analytics dashboard, asset card, and Inngest digest).

/** Short labels for badges, lists, and emails. */
export const CHANNEL_LABEL: Record<string, string> = {
  LINKEDIN_FOUNDER: "LinkedIn",
  X_THREAD: "X thread",
  BLOG_POST: "Blog post",
};

/** Longer labels for card headings. */
export const CHANNEL_LABEL_LONG: Record<string, string> = {
  ...CHANNEL_LABEL,
  LINKEDIN_FOUNDER: "LinkedIn — founder post",
};
