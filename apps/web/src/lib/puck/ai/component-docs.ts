export type LandingAiComponentDoc = {
  description: string;
  useWhen: string;
};

export const COMPONENT_DOCS: Record<string, LandingAiComponentDoc> = {
  Heading: {
    description: 'Semantic heading (h1–h6) with editable text and alignment.',
    useWhen: 'Page titles, section titles, or any short headline.',
  },
  Text: {
    description: 'Paragraph or rich text block for body copy.',
    useWhen: 'Descriptions, supporting copy, or any multi-line text.',
  },
  Image: {
    description: 'Single image with URL, alt text, and optional link.',
    useWhen: 'Photos, illustrations, logos, or banners that are not part of a template section.',
  },
  Button: {
    description: 'Call-to-action button with label, href, and style variants.',
    useWhen: 'Links, sign-up, buy, or any clickable CTA.',
  },
  Spacer: {
    description: 'Vertical empty space with a configurable height.',
    useWhen: 'Breathing room between sections without extra markup.',
  },
  Divider: {
    description: 'Horizontal rule / separator line.',
    useWhen: 'Visually splitting two content groups.',
  },
  Section: {
    description: 'Full-width container with a content slot for nested blocks.',
    useWhen: 'Grouping blocks into a page section with shared padding/background.',
  },
  Grid: {
    description: 'CSS grid container with a cells slot of GridCell children.',
    useWhen: 'Multi-column layouts that need explicit cells.',
  },
  Columns: {
    description: 'Equal or weighted column layout with a columns slot.',
    useWhen: 'Side-by-side content without a full grid.',
  },
  FlexRow: {
    description: 'Horizontal flex row with a content slot.',
    useWhen: 'Inline groups of buttons, badges, or small blocks.',
  },
  GridCell: {
    description: 'Single cell inside a Grid, with its own content slot.',
    useWhen: 'Only as a child of Grid.',
  },
  FormBlock: {
    description: 'Embeds a Merlin form by public id (fields come from the Forms app).',
    useWhen: 'Lead capture, waitlist, or contact forms. Use list_forms to get formPublicId.',
  },
  Marquee: {
    description: 'Magic UI infinite scrolling row of items (logos, quotes, chips).',
    useWhen: 'Logo clouds or repeating social proof that should animate horizontally.',
  },
  HeroVideoDialog: {
    description: 'Magic UI hero with a video thumbnail that opens a dialog player.',
    useWhen: 'Product demos or explainer videos in a hero.',
  },
  AnimatedList: {
    description: 'Magic UI stacked list that animates items in sequence.',
    useWhen: 'Notifications, activity feed, or feature bullets with motion.',
  },
  TweetCard: {
    description: 'Magic UI tweet/embed card styled like X/Twitter.',
    useWhen: 'Highlighting a specific social post as social proof.',
  },
  FrontCentre: {
    description: 'Full Front Centre landing template (hero + sections as one block).',
    useWhen: 'Dropping the complete Front Centre page, not individual Page UI sections.',
  },
  Specta: {
    description: 'Full Specta landing template as a single block.',
    useWhen: 'Dropping the complete Specta page.',
  },
  GnomieTemplate: {
    description: 'Full Gnomie landing template as a single block.',
    useWhen: 'Dropping the complete Gnomie page.',
  },
  Descomplicando: {
    description: 'Full Descomplicando event landing template as a single block.',
    useWhen: 'Dropping the complete event page.',
  },
  PageUiSocialProofBand: {
    description: 'Front Centre logo/social-proof strip.',
    useWhen: 'Trust logos or “as seen in” under a hero.',
  },
  PageUiVideoCta: {
    description: 'Front Centre video + call-to-action section.',
    useWhen: 'Pairing a demo video with a primary CTA.',
  },
  PageUiBand: {
    description: 'Front Centre colored band / announcement strip.',
    useWhen: 'A short highlight, announcement, or contrast band between sections.',
  },
  PageUiProductFeature: {
    description: 'Front Centre product feature row (copy + media).',
    useWhen: 'Explaining one product capability with an image or illustration.',
  },
  PageUiProductFeatureAlt: {
    description: 'Front Centre product feature with reversed media/copy layout.',
    useWhen: 'Alternating feature rows after PageUiProductFeature.',
  },
  PageUiFeaturesGrid: {
    description: 'Front Centre grid of feature cards (icon, title, text).',
    useWhen: 'Listing 3–6 product benefits at a glance.',
  },
  PageUiSocialBand: {
    description: 'Front Centre social / community band.',
    useWhen: 'Linking social channels or community stats.',
  },
  PageUiTestimonials: {
    description: 'Front Centre testimonial cards (quote, name, role, avatar).',
    useWhen: 'Customer quotes for the Front Centre look.',
  },
  PageUiSaleCta: {
    description: 'Front Centre closing sale / convert section.',
    useWhen: 'Final CTA, pricing nudge, or end-of-page conversion.',
  },
  PageUiFaq: {
    description: 'Front Centre FAQ accordion (question + answer items).',
    useWhen: 'Common questions on a Front Centre-style page.',
  },
  SpectaVideoCta: {
    description: 'Specta video hero with call-to-action.',
    useWhen: 'Opening a Specta-style page with a video.',
  },
  SpectaMarquee: {
    description: 'Specta logo/text marquee strip.',
    useWhen: 'Scrolling logos in the Specta visual language.',
  },
  SpectaTestimonialInline: {
    description: 'Specta single inline testimonial.',
    useWhen: 'One featured quote between Specta sections.',
  },
  SpectaProductFeature: {
    description: 'Specta product feature block with media and copy.',
    useWhen: 'A product capability in the Specta layout.',
  },
  SpectaShowcase: {
    description: 'Specta product/screenshot showcase.',
    useWhen: 'Highlighting UI shots or product visuals.',
  },
  SpectaShowcaseMarquee: {
    description: 'Specta showcase that scrolls as a marquee.',
    useWhen: 'Many screenshots that should keep moving.',
  },
  SpectaTestimonials: {
    description: 'Specta testimonial grid/list.',
    useWhen: 'Several customer quotes in Specta style.',
  },
  SpectaSaleCta: {
    description: 'Specta closing sale / convert section.',
    useWhen: 'End-of-page CTA for a Specta landing.',
  },
  GnomieVideoCta: {
    description: 'Gnomie video hero with call-to-action.',
    useWhen: 'Opening a Gnomie-style page with a video.',
  },
  GnomieExampleCarousel: {
    description: 'Gnomie carousel of example outputs or use cases.',
    useWhen: 'Showing several product examples in a slider.',
  },
  GnomieProductTour: {
    description: 'Gnomie step-by-step product tour section.',
    useWhen: 'Walking through product steps or onboarding.',
  },
  GnomieFeaturesGrid: {
    description: 'Gnomie feature cards grid.',
    useWhen: 'Listing product benefits in the Gnomie look.',
  },
  GnomieTestimonials: {
    description: 'Gnomie testimonials section.',
    useWhen: 'Customer quotes in Gnomie style.',
  },
  GnomiePricing: {
    description: 'Gnomie pricing table / plan cards.',
    useWhen: 'Showing plans and prices.',
  },
  GnomieSaleCta: {
    description: 'Gnomie closing sale / convert section.',
    useWhen: 'Final CTA on a Gnomie landing.',
  },
  GnomieFaq: {
    description: 'Gnomie FAQ accordion.',
    useWhen: 'Questions and answers in Gnomie style.',
  },
  DescomplicandoBanner: {
    description: 'Descomplicando top announcement / event banner.',
    useWhen: 'Event date, countdown, or top strip.',
  },
  DescomplicandoHero: {
    description: 'Descomplicando event hero (title, date, CTA).',
    useWhen: 'Main above-the-fold for an event landing.',
  },
  DescomplicandoAgenda: {
    description: 'Descomplicando agenda / schedule of sessions.',
    useWhen: 'Listing talks, times, and tracks.',
  },
  DescomplicandoSpeaker: {
    description: 'Descomplicando speaker profile (photo, name, bio).',
    useWhen: 'Featuring a speaker or host.',
  },
  DescomplicandoFooter: {
    description: 'Descomplicando event footer with links and legal.',
    useWhen: 'Closing an event landing.',
  },
};

export function getComponentDoc(type: string): LandingAiComponentDoc | undefined {
  return COMPONENT_DOCS[type];
}
