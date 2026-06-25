/**
 * Offline unit tests (no DB, no keys). Pure functions only.
 * Run: npx tsx scripts/test-unit.ts  (or: npm run test:unit)
 */

// Set deterministic env BEFORE importing modules that read it. lib/billing/plans
// reads STRIPE_PRICE_* at module load, so it is imported dynamically in main().
const KEY_A = "unit-test-encryption-key-aaaaaaaaaaaa";
const KEY_B = "unit-test-encryption-key-bbbbbbbbbbbb";
process.env.ENCRYPTION_KEY = KEY_A;
process.env.STRIPE_PRICE_STARTER = "price_test_starter";
process.env.STRIPE_PRICE_PRO = "price_test_pro";

import { encryptSecret, decryptSecret } from "../lib/crypto";
import { chunkText } from "../lib/knowledge/chunk";
import {
  toPlainText,
  toMarkdown,
  toHtml,
  exportFilename,
} from "../lib/content/serialize";

let failures = 0;
function check(name: string, cond: boolean, detail = "") {
  if (cond) console.log(`  ok  ${name}`);
  else {
    failures++;
    console.error(`FAIL  ${name} ${detail}`);
  }
}

async function main() {
  // --- lib/crypto ---
  console.log("\ncrypto:");
  const ct = encryptSecret("super-secret-value");
  check("encrypt → decrypt round-trips", decryptSecret(ct) === "super-secret-value");

  let threw = false;
  process.env.ENCRYPTION_KEY = KEY_B;
  try {
    decryptSecret(ct);
  } catch {
    threw = true;
  }
  process.env.ENCRYPTION_KEY = KEY_A;
  check("decrypt with the wrong key throws", threw);

  const buf = Buffer.from(ct, "base64");
  buf[buf.length - 1] ^= 0xff; // corrupt the ciphertext
  let tamperThrew = false;
  try {
    decryptSecret(buf.toString("base64"));
  } catch {
    tamperThrew = true;
  }
  check("decrypt of tampered ciphertext throws", tamperThrew);

  // --- lib/billing/plans (dynamic import: reads env at load) ---
  console.log("\nbilling/plans:");
  const { toPlanId, planForPriceId, PLANS } = await import("../lib/billing/plans");
  check("toPlanId(null) → FREE", toPlanId(null) === "FREE");
  check("toPlanId('') → FREE", toPlanId("") === "FREE");
  check("toPlanId('PRO') → PRO", toPlanId("PRO") === "PRO");
  check("toPlanId('bogus') → FREE", toPlanId("bogus") === "FREE");
  check("planForPriceId(starter) → STARTER", planForPriceId("price_test_starter") === "STARTER");
  check("planForPriceId(pro) → PRO", planForPriceId("price_test_pro") === "PRO");
  check("planForPriceId(unknown) → null", planForPriceId("nope") === null);
  check("planForPriceId(null) → null", planForPriceId(null) === null);
  check("FREE quota = 5", PLANS.FREE.monthlySignals === 5);
  check("PRO quota = 250", PLANS.PRO.monthlySignals === 250);

  // --- lib/content/serialize ---
  console.log("\ncontent/serialize:");
  const li = { hook: "HOOK", body: "BODY", takeaway: "TAKE", hashtags: ["a", "#b"] };
  const liText = toPlainText("LINKEDIN_FOUNDER", li);
  check("LinkedIn text has hook+body+takeaway", /HOOK[\s\S]*BODY[\s\S]*TAKE/.test(liText));
  check("LinkedIn text normalizes hashtags", liText.includes("#a #b"));
  check("LinkedIn markdown italicizes takeaway", toMarkdown("LINKEDIN_FOUNDER", li).includes("*TAKE*"));

  const xt = { tweets: ["first", "second"] };
  const xText = toPlainText("X_THREAD", xt);
  check("X text numbers tweets", xText.includes("1/ first") && xText.includes("2/ second"));

  const blog = {
    seoTitle: "SEO Title",
    metaDescription: "Meta",
    slug: "my-post",
    primaryKeyword: "kw",
    secondaryKeywords: ["kw2"],
    h1: "Heading One",
    tldr: "Summary",
    bodyMarkdown: "Paragraph body.",
    keyTakeaways: ["Takeaway one"],
    faq: [{ question: "Q?", answer: "A." }],
    wordCount: 3,
  };
  const blogMd = toMarkdown("BLOG_POST", blog);
  check("blog markdown has frontmatter title", blogMd.includes("title:"));
  check("blog markdown has slug", blogMd.includes("slug: my-post"));
  check("blog markdown has H1", blogMd.includes("# Heading One"));
  check("blog markdown has Key takeaways", blogMd.includes("## Key takeaways"));
  check("blog markdown has FAQ", blogMd.includes("## FAQ"));
  check("blog filename uses slug", exportFilename("BLOG_POST", blog, "md") === "my-post.md");
  check("blog html embeds JSON-LD", toHtml("BLOG_POST", blog).includes("application/ld+json"));

  // --- lib/knowledge/chunk (edge cases) ---
  console.log("\nknowledge/chunk:");
  check("empty input → []", chunkText("").length === 0);
  check("single word → 1 chunk", chunkText("word").length === 1 && chunkText("word")[0].includes("word"));
  check("huge paragraph hard-splits", chunkText("x".repeat(10_000)).length > 1);

  // --- summary ---
  console.log("");
  if (failures) {
    console.error(`\n${failures} check(s) failed.`);
    process.exit(1);
  }
  console.log("All unit checks passed.");
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
