// Common subscriptions billed in Canada, how they show up on a statement,
// and where to cancel. Every link was opened on 2026-10-29 and led to the
// service's own help page. The steps are short summaries; the linked page is the source of truth.
// "via" marks app stores that bill on behalf of other apps.

export const CATALOG = [
  { id: "netflix", name: "Netflix", cat: "Streaming", match: /netflix/i,
    url: "https://help.netflix.com/en/node/407",
    steps: ["Sign in at netflix.com and open Account.", "Choose Cancel Membership, then Finish Cancellation.", "You keep watching until the end of the period you paid for."] },
  { id: "spotify", name: "Spotify", cat: "Music", match: /spotify/i,
    url: "https://support.spotify.com/ca-en/article/cancel-premium/",
    steps: ["Sign in at spotify.com/account.", "Open Manage your plan, then Cancel Premium.", "If you pay through Apple or Google, cancel there instead."] },
  { id: "disney", name: "Disney+", cat: "Streaming", match: /disney\s*(plus|\+)|disneyplus/i,
    url: "https://help.disneyplus.com/article/disneyplus-cancel-subscription",
    steps: ["Sign in on a web browser and open Account.", "Choose your subscription, then Cancel Subscription.", "Confirm, and keep the email you get."] },
  { id: "crave", name: "Crave", cat: "Streaming", match: /\bcrave\b/i,
    url: "https://www.crave.ca/en/faq",
    steps: ["Sign in at crave.ca and open Account, then Manage Subscription.", "Cancel the plan and confirm.", "If Crave is billed by your TV or phone company, cancel with them."] },
  { id: "prime", name: "Amazon Prime", cat: "Shopping", match: /amazon\s*prime|prime\s*member|amzn\s*prime|primevideo|prime video/i,
    url: "https://www.amazon.ca/gp/help/customer/display.html?nodeId=G6LDPN7YJHYKH2J6",
    steps: ["Sign in at amazon.ca and open Your Prime Membership.", "Choose Update, cancel and more, then End membership.", "Amazon may refund unused months if you haven't used the benefits."] },
  { id: "apple", name: "Apple (App Store, iCloud, Apple TV+)", cat: "Apps", match: /apple\.com\/bill|apple\s*services|itunes/i, via: true,
    url: "https://support.apple.com/en-ca/118428",
    steps: ["On iPhone open Settings, tap your name, then Subscriptions.", "Pick the subscription and tap Cancel Subscription.", "One Apple charge can cover several apps, so check them all."] },
  { id: "googleplay", name: "Google Play subscriptions", cat: "Apps", match: /google\s*\*?\s*play|google\s*\*(?!youtube)/i, via: true,
    url: "https://support.google.com/googleplay/answer/7018481",
    steps: ["Open play.google.com/store/account/subscriptions.", "Pick the subscription and choose Cancel subscription.", "Deleting an app does not cancel it."] },
  { id: "youtube", name: "YouTube Premium", cat: "Streaming", match: /youtube\s*premium|youtubepremium|google\s*\*\s*youtube/i,
    url: "https://support.google.com/youtube/answer/6308278",
    steps: ["Open youtube.com/paid_memberships.", "Choose Manage membership, then Deactivate.", "Confirm and keep the email."] },
  { id: "googleone", name: "Google One", cat: "Storage", match: /google\s*\*?\s*(one|storage)/i,
    url: "https://support.google.com/googleone",
    steps: ["Open one.google.com and go to Settings.", "Choose Cancel membership.", "Check your storage first so mail and photos keep syncing."] },
  { id: "microsoft", name: "Microsoft 365 or Xbox", cat: "Software", match: /microsoft|msft|xbox/i,
    url: "https://account.microsoft.com/services",
    steps: ["Sign in at account.microsoft.com/services.", "Find the subscription and choose Manage, then Cancel subscription.", "Turning off recurring billing also stops renewal."] },
  { id: "playstation", name: "PlayStation Plus", cat: "Gaming", match: /playstation|sony\s*interactive|psn/i,
    url: "https://www.playstation.com/en-ca/support/store/cancel-ps-store-subscription/",
    steps: ["Sign in to your account on playstation.com.", "Open Subscriptions Management and choose Turn Off Auto-Renew.", "Access lasts to the end of the paid period."] },
  { id: "nintendo", name: "Nintendo Switch Online", cat: "Gaming", match: /nintendo/i,
    url: "https://support.nintendo.com/en-ca",
    steps: ["Sign in at accounts.nintendo.com.", "Open Shop Menu, then turn off automatic renewal.", "Confirm the change."] },
  { id: "adobe", name: "Adobe", cat: "Software", match: /adobe/i,
    url: "https://helpx.adobe.com/manage-account/using/cancel-subscription.html",
    steps: ["Sign in to your Adobe account and open Plans and payment.", "Choose Manage plan, then Cancel your plan.", "Annual plans paid monthly can carry a fee if you cancel early, so read the screen before you confirm."] },
  { id: "openai", name: "ChatGPT", cat: "AI tools", match: /openai|chatgpt/i,
    url: "https://help.openai.com/en/articles/7232927-how-do-i-cancel-my-chatgpt-plus-subscription",
    steps: ["Sign in to ChatGPT and open Settings, then Billing.", "Under Cancel plan, choose Cancel.", "Cancel at least a day before the next billing date."] },
  { id: "linkedin", name: "LinkedIn Premium", cat: "Career", match: /linkedin/i,
    url: "https://www.linkedin.com/help/linkedin/answer/a1338830",
    steps: ["Open your profile photo menu, then Premium features.", "Choose Manage Premium account, then Cancel subscription.", "Follow the prompts to the end."] },
  { id: "canva", name: "Canva", cat: "Software", match: /canva/i,
    url: "https://www.canva.com/help/",
    steps: ["Open Settings, then Billing and plans in Canva.", "Choose the plan and Cancel subscription.", "Confirm the cancellation."] },
  { id: "doordash", name: "DashPass", cat: "Food", match: /dashpass|doordash\s*dashpass/i,
    url: "https://help.doordash.com/consumers/s/article/How-do-I-cancel-my-DashPass-subscription",
    steps: ["Open the DoorDash app and go to Account, then DashPass.", "Choose End Subscription.", "Benefits last to the end of the billing period."] },
  { id: "hellofresh", name: "HelloFresh", cat: "Food", match: /hello\s*fresh/i,
    url: "https://www.hellofresh.ca/about/faq",
    steps: ["Sign in at hellofresh.ca and open Account settings, then Plan settings.", "Choose Cancel plan before the weekly cutoff.", "Skip next week first if the cutoff has passed."] },
  { id: "audible", name: "Audible", cat: "Books", match: /audible/i,
    url: "https://help.audible.ca/",
    steps: ["Sign in on audible.ca in a web browser.", "Open Account Details and choose Cancel membership.", "Use your credits first. They go away when you cancel."] },
  { id: "paramount", name: "Paramount+", cat: "Streaming", match: /paramount/i,
    url: "https://help.paramountplus.com/",
    steps: ["Sign in on a browser and open Account.", "Choose Cancel Subscription.", "If billed by Apple, Google or Amazon, cancel there."] },
  { id: "max", name: "Max", cat: "Streaming", match: /\bhbo\b|\bmax\.com|\bhbomax/i,
    url: "https://help.max.com/",
    steps: ["Sign in on max.com and open Subscription.", "Choose Manage Subscription, then Cancel.", "Confirm."] },
  { id: "patreon", name: "Patreon", cat: "Creators", match: /patreon/i,
    url: "https://www.patreon.com/help",
    steps: ["Open Memberships in Patreon.", "Pick the creator and choose Edit, then Cancel paid membership.", "Each creator is cancelled separately."] },
  { id: "twitch", name: "Twitch subscriptions", cat: "Creators", match: /twitch/i,
    url: "https://help.twitch.tv/",
    steps: ["Open Subscriptions in your Twitch settings.", "Pick the channel and turn off Renew.", "Each channel is separate."] },
  { id: "duolingo", name: "Duolingo Super", cat: "Learning", match: /duolingo/i,
    url: "https://support.duolingo.com/hc/en-us/articles/204830690",
    steps: ["Cancel through the store that bills you: Apple, Google, or duolingo.com settings.", "Turn off auto renew.", "Confirm."] },
  { id: "globe", name: "The Globe and Mail", cat: "News", match: /globe\s*(and|&)?\s*mail|globeandmail/i,
    url: "https://www.theglobeandmail.com/help/",
    steps: ["Sign in and open My Account, then Subscription.", "Choose Cancel or call customer service.", "Ask what discount they offer to stay before you confirm."] },
  { id: "nyt", name: "New York Times", cat: "News", match: /ny\s*times|nytimes/i,
    url: "https://www.nytimes.com/subscription/help",
    steps: ["Sign in and open Account, then Subscription overview.", "Choose Cancel subscription and follow the steps.", "You may be offered a cheaper rate first."] },
  { id: "sirius", name: "SiriusXM Canada", cat: "Music", match: /sirius/i,
    url: "https://www.siriusxm.ca/",
    steps: ["Call or chat with SiriusXM Canada customer care.", "Ask to cancel and get a confirmation number.", "Write the confirmation number down."] },
  { id: "goodlife", name: "GoodLife Fitness", cat: "Fitness", match: /goodlife/i,
    url: "https://www.goodlifefitness.com/contact-us.html",
    steps: ["Gym contracts often need written notice. Check your agreement for the notice period.", "Send the cancellation in writing and keep a copy.", "Watch the next statement to make sure the billing stopped."] },
  { id: "costco", name: "Costco membership", cat: "Shopping", match: /costco\s*(member|annual|renew)/i,
    url: "https://www.costco.ca/join-costco.html",
    steps: ["Go to the membership counter or call Costco.", "Ask to cancel. Costco refunds the fee if you are not satisfied.", "Turn off auto renew if you want to keep it to the end of the year."] },
  // Phone and internet: you usually don't cancel these, you ask for a better price.
  { id: "rogers", name: "Rogers", cat: "Phone and internet", telco: true, match: /\brogers\b/i, url: "https://www.rogers.com/support" },
  { id: "bell", name: "Bell", cat: "Phone and internet", telco: true, match: /\bbell\s*(canada|mobility|mts)?\b/i, url: "https://support.bell.ca/" },
  { id: "telus", name: "Telus", cat: "Phone and internet", telco: true, match: /\btelus\b/i, url: "https://www.telus.com/en/support" },
  { id: "fido", name: "Fido", cat: "Phone and internet", telco: true, match: /\bfido\b/i, url: "https://www.fido.ca/support" },
  { id: "koodo", name: "Koodo", cat: "Phone and internet", telco: true, match: /koodo/i, url: "https://www.koodomobile.com/help" },
  { id: "virgin", name: "Virgin Plus", cat: "Phone and internet", telco: true, match: /virgin\s*(plus|mobile)/i, url: "https://www.virginplus.ca/en/support/" },
  { id: "freedom", name: "Freedom Mobile", cat: "Phone and internet", telco: true, match: /freedom\s*mobile/i, url: "https://www.freedommobile.ca/en-CA/support" },
];

// Payment wrappers that hide the real merchant ("PAYPAL *SPOTIFY").
const WRAPPERS = /^(paypal|pp|sq|sp|tst|google|apple\.com\/bill)\s*\*\s*/i;

export function identify(desc) {
  const raw = String(desc);
  const wrapped = WRAPPERS.test(raw);
  const inner = raw.replace(WRAPPERS, "");
  // Prefer the specific service inside a wrapper over the wrapper itself.
  const specific = CATALOG.filter((c) => !c.via).find((c) => c.match.test(inner));
  // Google billing for YouTube or Google One is the normal way, not a second account.
  const via = wrapped && !(specific?.id === "youtube" || specific?.id === "googleone") ? raw.split("*")[0].trim().toUpperCase() : null;
  if (specific) return { ...specific, billedVia: via };
  const any = CATALOG.find((c) => c.match.test(raw));
  return any ? { ...any, billedVia: null } : null;
}
