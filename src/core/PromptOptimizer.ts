/**
 * PromptOptimizer — reduces token count of agent instruction strings.
 *
 * Strategies applied (in order):
 *  1. stripEmojiFromHeaders  — removes leading emoji from markdown headings
 *  2. removeIdentitySection  — deletes the boilerplate "Identity & Memory / Mindset" block
 *  3. removePersonalitySection — deletes "Communication Style / Personality" flavour text
 *  4. collapseBlankLines     — 3+ consecutive newlines → 2
 *
 * Usage:
 *   PromptOptimizer.compress(instructionText)   // all passes
 *   PromptOptimizer.estimateTokens(text)        // rough token count (chars / 4)
 */
export class PromptOptimizer {
  /**
   * Strip leading emoji from markdown headings only.
   * "## 🎯 Core Mission" → "## Core Mission"
   * Body text emoji are preserved (they may carry semantic meaning).
   */
  static stripEmojiFromHeaders(text: string): string {
    // Match ## ... lines where the first non-space char after the hashes is an emoji
    return text.replace(
      /^(#{1,6}[ \t]+)[\p{Emoji_Presentation}\p{Extended_Pictographic}][ \t]*/gmu,
      '$1',
    );
  }

  /**
   * Remove the "Identity & Memory" / "Identity & Mindset" section.
   * This is a ~60-token boilerplate block in every agent that restates the
   * role description already present in the frontmatter and opening sentence.
   *
   * Removes everything from the heading line up to (but not including) the
   * next same-level or higher heading.
   */
  static removeIdentitySection(text: string): string {
    return text.replace(
      /^#{1,3}[^\n]*(Identity|Mindset)[^\n]*\n[\s\S]*?(?=^#{1,3} |\Z)/gm,
      '',
    );
  }

  /**
   * Remove the "Communication Style" / "Your Communication Style" section.
   * These personality flavour sections add no operational instruction.
   */
  static removeCommunicationStyleSection(text: string): string {
    return text.replace(
      /^#{1,3}[^\n]*Communication Style[^\n]*\n[\s\S]*?(?=^#{1,3} |\Z)/gm,
      '',
    );
  }

  /**
   * Collapse 3+ consecutive blank lines into at most 2.
   */
  static collapseBlankLines(text: string): string {
    return text.replace(/\n{3,}/g, '\n\n');
  }

  /**
   * Estimate token count using the ~4 chars per token heuristic.
   * Accurate to within ±15% for English prose and code.
   */
  static estimateTokens(text: string): number {
    return Math.ceil(text.length / 4);
  }

  /**
   * Apply all compression passes and return the optimised text.
   * Typical savings: 15–25% reduction in token count.
   */
  static compress(text: string): string {
    let out = this.stripEmojiFromHeaders(text);
    out = this.removeIdentitySection(out);
    out = this.removeCommunicationStyleSection(out);
    out = this.collapseBlankLines(out);
    return out;
  }

  /**
   * Return a report comparing original vs compressed sizes.
   */
  static report(original: string, compressed: string): {
    originalTokens: number;
    compressedTokens: number;
    savedTokens: number;
    reductionPct: number;
  } {
    const originalTokens = this.estimateTokens(original);
    const compressedTokens = this.estimateTokens(compressed);
    const savedTokens = originalTokens - compressedTokens;
    const reductionPct = Math.round((savedTokens / originalTokens) * 100);
    return { originalTokens, compressedTokens, savedTokens, reductionPct };
  }
}
