# REDOX DESIGN — Clothing Brand Frontend Strategy
### Project Codename: `REDOX_APPAREL`
### Prepared for: Codex / Lead Frontend Developer
### Version: 1.0.0 | May 2026

---

## TABLE OF CONTENTS

1. [Brand Identity & Aesthetic DNA](#1-brand-identity--aesthetic-dna)
2. [Color System](#2-color-system)
3. [Typography System](#3-typography-system)
4. [Icon System (Flaticon)](#4-icon-system--flaticon)
5. [Spacing, Grid & Layout](#5-spacing-grid--layout)
6. [Tech Stack](#6-tech-stack)
7. [Folder & File Structure](#7-folder--file-structure)
8. [Pages — Complete List](#8-pages--complete-list)
9. [Component Library](#9-component-library)
10. [UX Strategy — Per Page](#10-ux-strategy--per-page)
11. [Product Experience (Apple-Level Showcase)](#11-product-experience-apple-level-showcase)
12. [UI Design System](#12-ui-design-system)
13. [Animation & Motion](#13-animation--motion)
14. [Responsive Strategy (Mobile-First)](#14-responsive-strategy-mobile-first)
15. [Cart, Wishlist & Commerce Logic](#15-cart-wishlist--commerce-logic)
16. [Performance & Security](#16-performance--security)
17. [Accessibility (A11Y)](#17-accessibility-a11y)
18. [SEO & Meta](#18-seo--meta)
19. [Developer Conventions](#19-developer-conventions)
20. [Build & Deployment Checklist](#20-build--deployment-checklist)

---

## 1. BRAND IDENTITY & AESTHETIC DNA

### What is Redox Design (Apparel)?
A premium streetwear / contemporary clothing brand. The name "Redox" (from Reduction-Oxidation chemistry) signals **transformation, tension, and energy** — raw materials chemically changed into something entirely new. The clothing brand carries the same ethos: taking raw street culture and refining it into powerful, wearable design.

### Target Audience
- Age 18–35
- Urban, fashion-forward, culturally aware
- Buys intentionally, not impulsively
- Follows Supreme, Off-White, Stone Island, Palace, A-COLD-WALL*
- Wants quality + story, not just hype

### Competitive Aesthetic References
| Brand | What to Borrow |
|---|---|
| **Nike** | Clean product photography, full-bleed hero, movement photography |
| **Adidas** | Grid layouts, bold typography, cultural storytelling |
| **Apple** | Scroll-triggered product reveals, cinematic video sections, obsessive detail |
| **A-COLD-WALL*** | Dark, industrial, technical aesthetic |
| **Supreme** | Drop culture urgency, editorial photography |
| **Arc'teryx** | Functional precision, premium product close-ups |

### Aesthetic Direction
**"Chemical Precision. Street Tension."**

The site should feel like walking into a high-concept boutique: dark, deliberate, every pixel intentional. Bold photography. Minimal UI chrome. The product is the hero. Typography that commands attention. Interactions that feel tactile. Nothing wasted. Think Apple's scroll-driven storytelling meets A-COLD-WALL*'s industrial rawness.

### Site Mood
- DARK (not light mode — this is a brand decision, non-negotiable)
- Minimal UI, maximum product presence
- Confident silence — not shouting at users
- Industrial textures, sharp edges, purposeful red
- Mobile-first (60%+ of fashion shoppers are on phone)

---

## 2. COLOR SYSTEM

```css
:root {
  /* ─── PRIMARY BRAND ─── */
  --color-red:          #D72638;   /* Core brand red — logo, key CTAs, accents */
  --color-red-dark:     #A51C2B;   /* Hover on red elements */
  --color-red-glow:     rgba(215, 38, 56, 0.15);

  /* ─── BASE (Dark Theme) ─── */
  --color-void:         #080808;   /* Deepest background — main body */
  --color-surface:      #0F0F0F;   /* Card/panel backgrounds */
  --color-surface-2:    #161616;   /* Elevated cards, hover state surfaces */
  --color-surface-3:    #1E1E1E;   /* Modals, drawers, overlays */
  --color-border:       #262626;   /* Default borders */
  --color-border-light: #383838;   /* Active / hover borders */

  /* ─── TEXT ─── */
  --color-text-primary:  #EFEFEF;  /* Headlines, primary text */
  --color-text-secondary:#ABABAB;  /* Body copy, descriptions */
  --color-text-muted:    #5C5C5C;  /* Disabled, placeholders, meta */
  --color-text-inverse:  #080808;  /* Text on light/white backgrounds */

  /* ─── ACCENT ─── */
  --color-white:         #FFFFFF;
  --color-off-white:     #F5F3EE;  /* Cream — used for premium light sections */
  --color-steel:         #B0B8C1;  /* Cool metallic — tags, badges */

  /* ─── STATUS ─── */
  --color-success:       #27AE60;
  --color-error:         #E74C3C;
  --color-warning:       #F39C12;
  --color-in-stock:      #2ECC71;
  --color-low-stock:     #E8A838;   /* "Only 3 left" warning */
  --color-out-of-stock:  #5C5C5C;

  /* ─── GRADIENTS ─── */
  --gradient-hero:       linear-gradient(160deg, #080808 0%, #160408 50%, #080808 100%);
  --gradient-product:    linear-gradient(180deg, #0F0F0F 0%, #080808 100%);
  --gradient-overlay:    linear-gradient(180deg, transparent 40%, rgba(8,8,8,0.95) 100%);
  --gradient-red-sweep:  linear-gradient(90deg, var(--color-red) 0%, #FF5767 100%);
  --gradient-shimmer:    linear-gradient(90deg, transparent, rgba(255,255,255,0.04), transparent);
}
```

### Color Usage Rules
| Element | Token |
|---|---|
| Page background | `--color-void` |
| Product cards | `--color-surface` |
| Drawers / overlays | `--color-surface-3` |
| Primary CTA ("Add to Cart") | `--color-red` |
| Secondary CTA ("View Collection") | `--color-border` border, white text |
| Price | `--color-text-primary` bold |
| Sale price | `--color-red` |
| Original price (crossed) | `--color-text-muted` strikethrough |
| Low stock label | `--color-low-stock` |
| In-stock dot | `--color-in-stock` |
| Out of stock | `--color-out-of-stock`, button disabled |
| Logo mark | `--color-red` on dark |
| Size selector (selected) | White background, black text |
| Size selector (unselected) | `--color-surface-2`, white text |

---

## 3. TYPOGRAPHY SYSTEM

### Font Pairing

| Role | Font | Weights | Character |
|---|---|---|---|
| Display / Campaign | **Druk Wide** or **Archivo Black** | 900 | Massive, commanding — hero headlines |
| Headings | **Barlow Condensed** | 600, 700 | Tight, athletic — section titles |
| Body / UI | **DM Sans** | 300, 400, 500 | Clean, modern, readable |
| Labels / Tags / Mono | **IBM Plex Mono** | 400, 500 | Technical precision — prices, sizes, SKUs |

> **Note to developer:** Druk Wide is a paid font. If budget doesn't allow, use **Archivo Black** (Google Fonts) — same visual weight, free. Never use Inter, Roboto, or system fonts.

```css
:root {
  /* ─── FONT FAMILIES ─── */
  --font-display:  'Archivo Black', sans-serif;
  --font-heading:  'Barlow Condensed', sans-serif;
  --font-body:     'DM Sans', sans-serif;
  --font-mono:     'IBM Plex Mono', monospace;

  /* ─── FLUID TYPE SCALE ─── */
  --text-xs:    clamp(0.65rem, 1vw,   0.70rem);
  --text-sm:    clamp(0.80rem, 1.2vw, 0.875rem);
  --text-base:  clamp(0.95rem, 1.5vw, 1rem);
  --text-md:    clamp(1rem,    1.8vw, 1.125rem);
  --text-lg:    clamp(1.15rem, 2vw,   1.25rem);
  --text-xl:    clamp(1.3rem,  2.5vw, 1.5rem);
  --text-2xl:   clamp(1.6rem,  3vw,   2rem);
  --text-3xl:   clamp(2rem,    4vw,   2.75rem);
  --text-4xl:   clamp(2.5rem,  5.5vw, 3.75rem);
  --text-hero:  clamp(4rem,    10vw,  9rem);
  --text-mega:  clamp(5rem,    14vw,  13rem);   /* Background decorative text */

  /* ─── LINE HEIGHTS ─── */
  --leading-tight:  0.95;
  --leading-snug:   1.1;
  --leading-normal: 1.6;

  /* ─── LETTER SPACING ─── */
  --tracking-tightest: -0.05em;
  --tracking-tight:    -0.03em;
  --tracking-normal:    0em;
  --tracking-wide:      0.08em;
  --tracking-widest:    0.25em;
}
```

### Type Usage Rules
- Hero campaign text → Archivo Black, `--text-hero` to `--text-mega`, `--tracking-tightest`
- Product names on PDP → Barlow Condensed 700, `--text-3xl` to `--text-4xl`
- Collection names → Barlow Condensed 600, `--text-2xl`
- Product card name → DM Sans 500, `--text-md`
- Price → IBM Plex Mono 500, `--text-lg`
- Body copy → DM Sans 400, `--text-base`, `--leading-normal`
- Eyebrow/category labels → IBM Plex Mono 400, `--text-xs`, `--tracking-widest`, uppercase
- Size buttons → DM Sans 500, `--text-sm`, uppercase
- CTA buttons → DM Sans 600, `--text-sm`, `--tracking-wide`, uppercase

---

## 4. ICON SYSTEM — FLATICON

**Source:** Flaticon free SVGs only. Inline as React components.

### Where Icons Appear (strict rules — no icon spam)
1. Navigation: Search, Bag (cart), Heart (wishlist), User (account), Hamburger
2. Product detail: Size guide icon, Heart (save to wishlist), Share
3. Cart drawer: Delete item, quantity +/−
4. Features strip: delivery truck, return arrow, lock (secure payment), star (quality)
5. Footer: Social media links (Instagram, TikTok, X, Pinterest)
6. Contact / info sections: email, location, phone

### Icon Style Rule
- Style: **Flaticon "Lineal"** or **"Bold"** — consistent weight
- Size: 20px in nav, 24px in product, 16px in lists
- Color: `--color-text-secondary` for utility, `--color-red` for actions (wishlist active, cart with items)
- NEVER use icon fonts — SVG only

---

## 5. SPACING, GRID & LAYOUT

```css
:root {
  /* ─── SPACING SCALE ─── */
  --space-1:  4px;
  --space-2:  8px;
  --space-3:  12px;
  --space-4:  16px;
  --space-5:  24px;
  --space-6:  32px;
  --space-7:  48px;
  --space-8:  64px;
  --space-9:  96px;
  --space-10: 128px;
  --space-11: 160px;
  --space-12: 200px;

  /* ─── SECTIONS ─── */
  --section-y:  clamp(80px, 10vw, 160px);
  --section-x:  clamp(16px, 5vw, 80px);

  /* ─── CONTAINERS ─── */
  --container-max:    1440px;
  --container-tight:  1100px;
  --container-narrow: 720px;

  /* ─── BORDER RADIUS ─── */
  --radius-sm:   2px;   /* tags, chips */
  --radius-md:   6px;   /* buttons, inputs */
  --radius-lg:   12px;  /* cards */
  --radius-xl:   20px;  /* large cards */
  --radius-full: 9999px;

  /* ─── SHADOWS ─── */
  --shadow-product:  0 8px 40px rgba(0,0,0,0.7);
  --shadow-card:     0 4px 20px rgba(0,0,0,0.5);
  --shadow-red:      0 0 40px var(--color-red-glow);
  --shadow-drawer:  -8px 0 60px rgba(0,0,0,0.8);
}
```

### Grid System
- 12-column CSS Grid
- Product grids: 4-col (1440px+), 3-col (1024–1440px), 2-col (600–1024px), 1-col (mobile)
- Collection hero: always full viewport width (`100vw`)
- PDP (Product Detail Page): 2-column — images left 60%, details right 40%

---

## 6. TECH STACK

| Layer | Choice | Reason |
|---|---|---|
| Framework | **Next.js 14 (App Router)** | SSR, SSG, SEO, performance |
| Language | **TypeScript** | Type-safe — critical for product/cart data |
| Styling | **CSS Modules + CSS Custom Properties** | Zero runtime, scoped |
| Animation | **GSAP ScrollTrigger + Framer Motion** | Apple-level scroll storytelling |
| Commerce | **Shopify Storefront API** (or custom) | Headless e-commerce, inventory, checkout |
| State (Cart) | **Zustand** | Lightweight, persistent cart state |
| State (global) | **Zustand** | Auth, wishlist, UI state |
| Forms | **React Hook Form + Zod** | Search, filters, checkout validation |
| Image CDN | **Cloudinary** (or Shopify CDN) | Optimized product images, zoom |
| Fonts | **Google Fonts via next/font** | Self-hosted, zero FOUT |
| Images | **next/image** | WebP, lazy load, priority for hero |
| Analytics | **Plausible + Shopify Analytics** | Privacy-first |
| Email | **Resend** | Order confirmation, waitlist |
| Search | **Algolia InstantSearch** | Fast, faceted product search |
| Hosting | **Vercel** | CDN edge, preview deploys |
| Version Control | **Git + GitHub** | Standard |

---

## 7. FOLDER & FILE STRUCTURE

```
redox-apparel/
├── public/
│   ├── favicon.ico
│   ├── favicon.svg
│   ├── og-image.jpg               ← 1200×630 brand OG image
│   ├── robots.txt
│   ├── sitemap.xml
│   └── assets/
│       ├── icons/                 ← Flaticon SVG files
│       │   ├── bag.svg
│       │   ├── heart.svg
│       │   ├── search.svg
│       │   ├── user.svg
│       │   ├── truck.svg
│       │   ├── return.svg
│       │   ├── lock.svg
│       │   ├── star.svg
│       │   └── ...
│       ├── images/
│       │   ├── logo/
│       │   │   ├── redox-logo.svg
│       │   │   ├── redox-logo-white.svg
│       │   │   └── redox-mark.svg
│       │   ├── campaigns/         ← Hero / editorial campaign images
│       │   ├── lookbook/
│       │   └── brand/             ← About, story images
│       └── videos/
│           ├── hero-campaign.mp4
│           └── collection-preview.mp4
│
├── src/
│   ├── app/                       ← Next.js App Router
│   │   ├── layout.tsx             ← Root layout (fonts, providers, navbar, footer)
│   │   ├── page.tsx               ← Homepage
│   │   ├── globals.css
│   │   │
│   │   ├── collections/
│   │   │   ├── page.tsx           ← All collections listing
│   │   │   └── [slug]/
│   │   │       └── page.tsx       ← Single collection
│   │   │
│   │   ├── products/
│   │   │   └── [slug]/
│   │   │       └── page.tsx       ← Product Detail Page (PDP)
│   │   │
│   │   ├── shop/
│   │   │   └── page.tsx           ← All products (filtered, sorted)
│   │   │
│   │   ├── drops/
│   │   │   └── page.tsx           ← Upcoming & past drops
│   │   │
│   │   ├── lookbook/
│   │   │   ├── page.tsx           ← Editorial lookbook listing
│   │   │   └── [slug]/
│   │   │       └── page.tsx       ← Individual lookbook issue
│   │   │
│   │   ├── about/
│   │   │   └── page.tsx
│   │   │
│   │   ├── sustainability/
│   │   │   └── page.tsx
│   │   │
│   │   ├── size-guide/
│   │   │   └── page.tsx
│   │   │
│   │   ├── contact/
│   │   │   └── page.tsx
│   │   │
│   │   ├── account/
│   │   │   ├── page.tsx           ← Dashboard (orders, profile, wishlist)
│   │   │   ├── orders/
│   │   │   │   └── page.tsx
│   │   │   └── wishlist/
│   │   │       └── page.tsx
│   │   │
│   │   ├── search/
│   │   │   └── page.tsx           ← Search results (Algolia)
│   │   │
│   │   ├── not-found.tsx          ← Branded 404
│   │   │
│   │   └── api/
│   │       ├── contact/
│   │       │   └── route.ts
│   │       ├── newsletter/
│   │       │   └── route.ts
│   │       ├── waitlist/
│   │       │   └── route.ts
│   │       └── revalidate/
│   │           └── route.ts       ← Shopify webhook revalidation
│   │
│   ├── components/
│   │   ├── layout/
│   │   │   ├── Navbar/
│   │   │   │   ├── Navbar.tsx
│   │   │   │   ├── Navbar.module.css
│   │   │   │   ├── NavSearch.tsx
│   │   │   │   ├── NavSearch.module.css
│   │   │   │   ├── MobileMenu.tsx
│   │   │   │   └── MobileMenu.module.css
│   │   │   ├── Footer/
│   │   │   │   ├── Footer.tsx
│   │   │   │   └── Footer.module.css
│   │   │   ├── AnnouncementBar/   ← Top strip ("FREE SHIPPING OVER $100")
│   │   │   │   ├── AnnouncementBar.tsx
│   │   │   │   └── AnnouncementBar.module.css
│   │   │   └── PageWrapper/
│   │   │       ├── PageWrapper.tsx
│   │   │       └── PageWrapper.module.css
│   │   │
│   │   ├── ui/                    ← Atomic, reusable primitives
│   │   │   ├── Button/
│   │   │   ├── Badge/             ← "NEW", "SALE", "LIMITED"
│   │   │   ├── Tag/               ← Category tags
│   │   │   ├── Chip/              ← Filter chips
│   │   │   ├── SectionLabel/      ← Eyebrow label "// DROP 001"
│   │   │   ├── Input/
│   │   │   ├── Select/
│   │   │   ├── Textarea/
│   │   │   ├── Checkbox/
│   │   │   ├── Radio/
│   │   │   ├── RangeSlider/       ← Price filter
│   │   │   ├── Accordion/         ← FAQs, product details, size guide
│   │   │   ├── Modal/
│   │   │   ├── Drawer/            ← Cart drawer, filter drawer
│   │   │   ├── Toast/
│   │   │   ├── Loader/
│   │   │   ├── Skeleton/          ← Loading placeholders for products
│   │   │   ├── Tabs/
│   │   │   ├── Icon/
│   │   │   ├── Divider/
│   │   │   └── ProgressBar/       ← "Spend $X more for free shipping"
│   │   │
│   │   ├── product/               ← Product-specific components
│   │   │   ├── ProductCard/
│   │   │   │   ├── ProductCard.tsx
│   │   │   │   └── ProductCard.module.css
│   │   │   ├── ProductGrid/
│   │   │   ├── ProductImages/     ← PDP image gallery + zoom
│   │   │   ├── ProductInfo/       ← Name, price, description
│   │   │   ├── SizeSelector/
│   │   │   ├── ColorSelector/
│   │   │   ├── QuantitySelector/
│   │   │   ├── AddToCartButton/
│   │   │   ├── WishlistButton/
│   │   │   ├── ShareButton/
│   │   │   ├── SizeGuideModal/
│   │   │   ├── ProductBreadcrumb/
│   │   │   ├── ProductBadge/      ← "SOLD OUT", "NEW", "−20%"
│   │   │   ├── ProductTabs/       ← Description, Details, Shipping, Reviews
│   │   │   ├── RelatedProducts/
│   │   │   ├── RecentlyViewed/
│   │   │   └── StockIndicator/
│   │   │
│   │   ├── cart/
│   │   │   ├── CartDrawer/        ← Slide-in cart
│   │   │   ├── CartItem/
│   │   │   ├── CartSummary/
│   │   │   ├── CartEmpty/
│   │   │   └── UpsellStrip/       ← "You may also like"
│   │   │
│   │   ├── sections/              ← Page-level sections
│   │   │   ├── home/
│   │   │   │   ├── HeroCampaign/
│   │   │   │   ├── FeaturedCollection/
│   │   │   │   ├── DropsSection/
│   │   │   │   ├── LookbookTeaser/
│   │   │   │   ├── BestSellers/
│   │   │   │   ├── BrandManifesto/
│   │   │   │   ├── InstagramFeed/
│   │   │   │   └── NewsletterSection/
│   │   │   ├── collections/
│   │   │   │   ├── CollectionHero/
│   │   │   │   ├── CollectionIntro/
│   │   │   │   └── CollectionFilters/
│   │   │   ├── lookbook/
│   │   │   │   ├── LookbookHero/
│   │   │   │   ├── LookbookGrid/
│   │   │   │   └── LookbookSpread/ ← Full-page editorial spread
│   │   │   ├── drops/
│   │   │   │   ├── DropHero/
│   │   │   │   ├── CountdownTimer/
│   │   │   │   ├── DropPreview/
│   │   │   │   └── WaitlistForm/
│   │   │   ├── about/
│   │   │   │   ├── AboutHero/
│   │   │   │   ├── BrandStory/
│   │   │   │   ├── ManifestoSection/
│   │   │   │   └── FounderSection/
│   │   │   └── sustainability/
│   │   │       ├── SustainabilityHero/
│   │   │       ├── MaterialsSection/
│   │   │       └── CommitmentsSection/
│   │   │
│   │   └── common/
│   │       ├── MarqueeStrip/
│   │       ├── TrustBadges/       ← Delivery, Returns, Secure, Quality
│   │       ├── ReviewCard/
│   │       ├── ReviewStars/
│   │       ├── CookieBanner/
│   │       ├── BackToTop/
│   │       └── SocialProofStrip/  ← "4.9 stars · 2,400+ reviews"
│   │
│   ├── hooks/
│   │   ├── useCart.ts             ← Cart state (Zustand)
│   │   ├── useWishlist.ts         ← Wishlist state (Zustand)
│   │   ├── useScrollAnimation.ts
│   │   ├── useScrollProgress.ts   ← % scrolled (for progress bar)
│   │   ├── useCountdown.ts        ← Drop countdown timer
│   │   ├── useMediaQuery.ts
│   │   ├── useLockScroll.ts
│   │   ├── useImageZoom.ts        ← PDP image zoom
│   │   ├── useRecentlyViewed.ts   ← localStorage recent products
│   │   └── useToast.ts
│   │
│   ├── store/
│   │   ├── cart.store.ts          ← Zustand cart store
│   │   ├── wishlist.store.ts      ← Zustand wishlist store
│   │   └── ui.store.ts            ← Drawer/modal open state
│   │
│   ├── lib/
│   │   ├── constants.ts           ← Nav links, socials, shipping threshold
│   │   ├── metadata.ts
│   │   ├── utils.ts               ← cn(), formatPrice(), formatDate()
│   │   ├── formatters.ts          ← Currency, weight, dimensions
│   │   └── shopify/               ← Shopify Storefront API
│   │       ├── client.ts
│   │       ├── queries/
│   │       │   ├── products.ts
│   │       │   ├── collections.ts
│   │       │   └── cart.ts
│   │       └── types.ts
│   │
│   ├── types/
│   │   ├── index.ts
│   │   ├── product.ts
│   │   ├── collection.ts
│   │   ├── cart.ts
│   │   ├── order.ts
│   │   ├── review.ts
│   │   └── drop.ts
│   │
│   ├── data/                      ← Static/seed data before Shopify
│   │   ├── products.ts
│   │   ├── collections.ts
│   │   ├── drops.ts
│   │   ├── testimonials.ts
│   │   └── faq.ts
│   │
│   └── styles/
│       ├── tokens/
│       │   ├── colors.css
│       │   ├── typography.css
│       │   ├── spacing.css
│       │   └── animations.css
│       └── utilities.css
│
├── .env.local
├── .env.example
├── .gitignore
├── .eslintrc.json
├── .prettierrc
├── tsconfig.json
├── next.config.ts
├── package.json
└── README.md
```

---

## 8. PAGES — COMPLETE LIST

| # | Route | Type | Purpose |
|---|---|---|---|
| 1 | `/` | SSG | Homepage — campaign hero, drops, collections, lookbook teaser |
| 2 | `/shop` | SSR | All products — filterable, sortable, paginated |
| 3 | `/collections` | SSG | Collections overview grid |
| 4 | `/collections/[slug]` | SSG | Single collection — hero, filtered products |
| 5 | `/products/[slug]` | SSG+ISR | Product Detail Page — full showcase |
| 6 | `/drops` | SSG+ISR | Upcoming & past drops with countdown |
| 7 | `/lookbook` | SSG | Editorial lookbook listing |
| 8 | `/lookbook/[slug]` | SSG | Full lookbook spread — editorial layout |
| 9 | `/about` | SSG | Brand story, manifesto, founder |
| 10 | `/sustainability` | SSG | Materials, ethics, commitments |
| 11 | `/size-guide` | SSG | Size charts with measurement guide |
| 12 | `/contact` | SSG | Support contact form |
| 13 | `/search` | CSR | Search results (Algolia) |
| 14 | `/account` | CSR | Dashboard — orders, profile, wishlist |
| 15 | `/account/orders` | CSR | Order history |
| 16 | `/account/wishlist` | CSR | Saved wishlist items |
| 17 | `/not-found` | Static | Branded 404 |

### Collections (pre-planned slugs)
- `/collections/core` — Essentials, everyday pieces
- `/collections/outerwear` — Jackets, coats
- `/collections/bottoms` — Trousers, shorts
- `/collections/tops` — Tees, longsleeves, hoodies
- `/collections/accessories` — Caps, bags, socks
- `/collections/archive` — Past seasons

---

## 9. COMPONENT LIBRARY

### A. ProductCard
The most used component. Must be perfect.

```
Variants: default | compact | featured (large)
States:   default | hover | loading (skeleton) | sold-out
```

**Structure:**
- Image container (aspect ratio 3:4 — portrait, like Nike/Adidas)
- On hover (desktop): second image fades in (alternate angle)
- On hover: "Quick Add" pill appears over image (bottom center)
- "Quick Add" opens a mini size-select popover — add to cart without leaving page
- Badge top-left: "NEW" / "SALE" / "LIMITED" / "SOLD OUT"
- Wishlist heart — top-right, always visible on mobile, on hover on desktop
- Below image: product name (left), price (right)
- Color swatches if product has variants — max 5 dots shown, "+N more" if more

**Card rules:**
- Image: always 3:4 aspect ratio, `object-fit: cover`
- No text inside the image — overlay is for interactions only
- Sold-out cards: image desaturated, "SOLD OUT" badge, no Quick Add

---

### B. Navbar
The navbar is the most visited component on a fashion site.

**Desktop Layout:**
```
[REDOX LOGO]   [NEW · SHOP · COLLECTIONS · DROPS · LOOKBOOK · ABOUT]   [SEARCH] [WISHLIST(#)] [BAG(#)] [ACCOUNT]
```

**Behavior:**
- Default: transparent over hero, white logo + links
- On scroll > 80px: solid `--color-void` background, `backdrop-filter: blur(20px)`, border-bottom 1px
- On hover over nav link: red underline slides in from left
- Cart icon shows red dot with item count when cart has items
- Wishlist icon shows red dot with count when wishlist has items
- Search: clicking the icon expands a full-width search bar inline (animates down, pushes content)

**Mobile Layout (<768px):**
```
[REDOX LOGO]   [SEARCH] [BAG(#)] [HAMBURGER]
```
- Hamburger opens full-screen overlay
- Links stack vertically, large, Barlow Condensed
- Sub-menus expand inline with arrow indicator
- Close button top-right
- Social icons at bottom

---

### C. AnnouncementBar
Thin strip above navbar.
- Scrolling marquee of announcement text: "FREE SHIPPING ON ORDERS OVER $100 · NEW DROP FRIDAY 8PM GMT · FREE RETURNS WITHIN 30 DAYS ·"
- Height: 36px
- Background: `--color-red` or `--color-void` (configurable)
- Dismissible (X button right)

---

### D. CartDrawer
Slides in from right. `position: fixed`, `z-index: 2000`.

**States:**
1. **Empty:** centered icon, "Your bag is empty", [Start Shopping] button
2. **Has items:** 
   - Header: "YOUR BAG (3)"
   - Item list: product image, name, size, color, quantity selector, price, delete icon
   - Shipping progress bar: "Add $X more for free shipping"
   - Upsell: "Complete the look" — 2 product thumbnails
   - Summary: subtotal, shipping note
   - [CHECKOUT →] button — primary, full-width
   - [Continue Shopping] text link

---

### E. SizeSelector
- Buttons in a row: XS S M L XL XXL (or numeric: 28 30 32 ...)
- Available sizes: white border, white text — hover: red border
- Selected size: white background, black text
- Out-of-stock size: muted text, strikethrough, not clickable
- Size guide link: small text link opens `SizeGuideModal`

**SizeGuideModal:**
- Full overlay or side panel
- Tab between CM and INCHES
- Table: size | chest | waist | hip | length
- Measurement diagram illustration

---

### F. ProductImages Gallery
Apple-level image showcase.

**Desktop:**
- Left column: vertical thumbnail strip (4–6 images)
- Right area: large active image
- Hover on large image: cursor becomes magnifier, image zooms 2× on hover
- Click image: opens full-screen lightbox gallery

**Mobile:**
- Horizontal swipe carousel
- Dots indicator below
- Pinch-to-zoom on touch

**Image types to plan for (communicate to photographer):**
1. Hero shot — front view, clean background
2. Back view — clean background
3. Detail shot — fabric texture, stitching, logo
4. On-model (lifestyle) — front
5. On-model (lifestyle) — back / 3/4
6. Flat lay — overhead

---

### G. MarqueeStrip
Same as design studio but clothing-specific:
- Contents: "REDOX DESIGN · SS26 · CRAFTED FOR THE UNCOMMON · DROP 003 FRIDAY · FREE RETURNS · REDOX DESIGN · SS26 ·"
- Two variants: red background white text (urgent), dark background muted text (ambient)
- Pause on hover

---

### H. CountdownTimer
For drop pages. Shows `DD : HH : MM : SS`.
- Large, IBM Plex Mono, bright
- Red accent on separators
- On zero: triggers confetti + "DROP IS LIVE" message + reload products

---

### I. ReviewStars + ReviewCard
- Stars: custom SVG star, red fill for active
- ReviewCard: stars, headline, body, reviewer name, verified badge, date, size purchased
- Sort by: Most Recent, Highest Rated, Most Helpful
- "Verified Purchase" badge (Flaticon badge icon, green)

---

## 10. UX STRATEGY — PER PAGE

### HOMEPAGE (`/`)

**Goal:** Create desire. Build brand identity. Drive to drops and collections.

**Sections in order:**

1. **AnnouncementBar** — "NEW DROP FRIDAY · FREE SHIPPING OVER $100"

2. **HeroCampaign** (100dvh)
   - Full-viewport campaign image or autoplay video (muted, loop, playsInline)
   - Massive display text on top: 2–3 words max. E.g. `"BUILT DIFFERENT."` or `"NO NOISE."` — Archivo Black, near `--text-mega`
   - Text layered over image (dark gradient overlay for legibility)
   - Bottom-left: Collection name + season e.g. "CORE COLLECTION — SS26"
   - Two buttons: [SHOP NOW →] (primary) | [EXPLORE LOOKBOOK] (ghost)
   - Scroll indicator bottom-center (animated arrow)

3. **FeaturedCollection** (full-bleed)
   - Alternating layout: image left, text right (then text left, image right for second)
   - Each block: large image (editorial, on-model), collection name, 1-sentence description, [Shop Collection →]
   - Subtle border-bottom between blocks

4. **MarqueeStrip** — red background

5. **DropsSection**
   - Eyebrow: `// DROPS`
   - Headline: `"What's Coming."`
   - Card for next drop: teaser image (blurred/cropped), drop name, countdown timer, [JOIN WAITLIST →]
   - Below: 2 past drop archive cards (greyed out, "SOLD OUT" label)

6. **BestSellers**
   - Eyebrow: `// BEST SELLERS`
   - Headline: `"The Ones That Sell Out First."`
   - Horizontal scroll on mobile, 4-column grid on desktop
   - Each is a ProductCard (default variant)

7. **LookbookTeaser**
   - Full-width editorial section — dark, cinematic
   - Split screen: left = large editorial photo, right = issue title, description, [VIEW LOOKBOOK →]
   - Or: overlapping photo grid

8. **BrandManifesto**
   - Dark section, centered
   - Large Archivo Black text: `"WE DON'T MAKE CLOTHES. WE MAKE STATEMENTS."`
   - Below: 2-line sub-copy in DM Sans
   - [Our Story →] ghost button

9. **TrustBadges**
   - 4 icons in a row: Free Shipping (truck), Free Returns (arrow), Secure Payment (lock), Ethically Made (leaf)
   - Icons from Flaticon, small, muted — not decorative, just reassuring

10. **InstagramFeed** 
    - Eyebrow: `// @REDOXDESIGN`
    - 6-image responsive grid, each links to the Instagram post
    - Hover: red overlay + Instagram icon

11. **NewsletterSection**
    - Dark surface background
    - Headline: `"First to Know. First to Cop."`
    - Sub: *"Join 12,000+ subscribers. Get early access to drops."*
    - Email input + [SUBSCRIBE →] button
    - Micro-copy below: "No spam. Unsubscribe anytime."

---

### SHOP PAGE (`/shop`)

**Goal:** Help users find what they want quickly. Reduce friction to add to cart.

**Layout:** 2-column: sidebar filters (left, collapsible on tablet) + product grid (right)

**Filter Sidebar:**
- Categories: All, Tops, Bottoms, Outerwear, Accessories
- Collections: Core, Archive, Collaboration
- Size: XS S M L XL XXL (checkbox)
- Color: color dot swatches (checkbox)
- Price: dual-handle range slider ($0–$500)
- Availability: In Stock only toggle
- [Clear All Filters] — only shows if filters active
- On mobile: filters in a slide-up drawer, triggered by [FILTER & SORT] button at top

**Sort Bar (top of product grid):**
- Left: "Showing 42 products" count
- Right: Sort by dropdown — Featured / New Arrivals / Price: Low–High / Price: High–Low / Best Selling

**Product Grid:**
- 4 columns desktop, 3 tablet, 2 mobile
- On filter change: GSAP fade-out, filter, fade-in of new results
- Skeleton loading cards while fetching
- Infinite scroll OR "Load More" button (Load More preferred — better for SEO)
- No results state: illustration + "No products found. Try removing some filters."

---

### PRODUCT DETAIL PAGE — PDP (`/products/[slug]`)

**Goal:** This is the most important page. It must convert. Design it like Apple designs a product launch page.

**Above-the-fold layout (desktop):**
```
[  ←  Breadcrumb: Shop / Tops / Graphic Tee            ]
[Thumbnail]  [    LARGE IMAGE    ]  [ Product Info Panel ]
[Thumbnail]  [    LARGE IMAGE    ]  [ Name               ]
[Thumbnail]  [    LARGE IMAGE    ]  [ Price              ]
[Thumbnail]  [                   ]  [ Color Selector     ]
[Thumbnail]  [                   ]  [ Size Selector      ]
             [                   ]  [ [ADD TO CART]      ]
             [                   ]  [ [SAVE TO WISHLIST] ]
             [                   ]  [ Trust badges       ]
```

**Product Info Panel (right column) — complete spec:**

1. **Breadcrumb** — `Shop / Tops / GRAPHIC TEE 001`
2. **Product badge** — "NEW" or "LIMITED" or "SALE" — top of panel
3. **Product name** — Barlow Condensed 700, `--text-3xl`
4. **Rating summary** — ★★★★☆ 4.7 (128 reviews) — links to reviews section
5. **Price block:**
   - Normal: `$89.00` — IBM Plex Mono, large
   - On sale: `$59.00` (red) + `$89.00` (strikethrough, muted) + "SAVE 34%" badge
6. **Short description** — 2–3 lines max, DM Sans
7. **Color selector** — Labeled swatches. Selected: red border ring. Swatch = product thumbnail color
8. **Size selector** — Button group (see component spec)
9. **[SIZE GUIDE]** — small text link, opens modal
10. **Quantity selector** — minus / number / plus, min 1
11. **[ADD TO CART →]** button — full-width, red, large (56px tall), prominent
12. **[SAVE TO WISHLIST]** — secondary button, full-width
13. **Stock indicator:** `● In Stock` (green) or `⚠ Only 2 left` (amber) or `✕ Sold Out` (muted)
14. **Trust strip:** 4 micro-icons: Free shipping · Free returns · Secure checkout · 2yr warranty
15. **Share** — small icon row: copy link, X, Pinterest

**Below the fold — Product Tabs:**
Four tabs: `DESCRIPTION` | `DETAILS & MATERIALS` | `SIZE & FIT` | `SHIPPING & RETURNS`

- **Description:** Brand copy about the product — story, inspiration
- **Details & Materials:** Bulleted list — fabric composition, weight, care instructions, country of manufacture
- **Size & Fit:** Fit type (Regular/Relaxed/Slim), model's measurements + size worn, measurements table
- **Shipping & Returns:** Policy summary — delivery times, free returns window

**Reviews Section (below tabs):**
- Summary: average star rating (large), distribution bars (5★ ████ 70%, 4★ ██ 20%...)
- [WRITE A REVIEW] button
- Review cards grid — sorted, filterable by star
- Pagination

**Apple-Style Scroll Sections (below product info — optional but premium):**
- Fabric close-up section: full-bleed image, text fades in on scroll: *"180GSM double-stitched premium cotton"*
- Construction section: detail photo + feature callouts with animated lines pointing to stitching
- On-model movement video: short autoplay clip showing the piece in motion
- "Complete the Look" — styled outfit suggestions (4 related products)

**Related Products:**
- "YOU MIGHT ALSO LIKE" — 4 ProductCards

**Recently Viewed:**
- Horizontal scroll row — persisted via localStorage

---

### COLLECTIONS PAGE (`/collections`)

**Goal:** Inspire. Show breadth of the brand.

1. Full-bleed hero: editorial photo, "COLLECTIONS" headline
2. Large grid of collection cards: each is a tall image with collection name overlaid (gradient bottom)
3. Hover: image zooms slightly in, red overlay edge, collection item count appears

---

### COLLECTION DETAIL PAGE (`/collections/[slug]`)

**Goal:** Immerse user in the collection, then convert.

1. **CollectionHero** — full-width campaign image, collection name huge (Archivo Black), season tag, short collection description
2. Optional autoplay campaign video with muted audio
3. **CollectionIntro** — 2-sentence collection story, editorial photo on right
4. **Filters + Product Grid** — same as /shop but pre-filtered to collection
5. **Lookbook link** — "See the full lookbook →" editorial teaser card at bottom

---

### DROPS PAGE (`/drops`)

**Goal:** Build hype. Grow waitlist. Create urgency.

1. **DropHero** — "DROPS" massive headline, sub: *"Limited. Intentional. Sold when they're gone."*
2. **Next Drop card (UPCOMING):**
   - Teaser image (intentionally cropped/blurred OR full reveal based on strategy)
   - Drop name, date/time, brief description
   - **CountdownTimer** component — large, prominent
   - Waitlist form: email input + [NOTIFY ME] button
   - Expected item count: "12 pieces. Zero restocks."
3. **Past Drops grid** — labeled "ARCHIVE", all cards show "SOLD OUT" state. Still clickable to view the products (even if unavailable — aspirational browsing).

---

### LOOKBOOK PAGE (`/lookbook/[slug]`)

**Goal:** Editorial inspiration. This is the brand as art.

Design this like a digital magazine spread. Sections alternate between:
- Full-bleed image (100vw)
- 2-column image grid
- 1 large + 2 small grid
- Quote overlay: editorial copy on dark background
- Product callout: image + "SHOP THIS LOOK" card with 3 tagged ProductCards

Typography: all Barlow Condensed or Archivo Black. Editorial, bold.

---

### ABOUT PAGE (`/about`)

**Goal:** Build emotional connection. This is a brand that stands for something.

1. **AboutHero** — editorial black-and-white photo, `"WE ARE REDOX."` — massive
2. **BrandStory** — text + photo alternating (origin story, values, mission)
3. **ManifestoSection** — black background, centered white text, each line appears on scroll
   - *"We believe clothes are language."*
   - *"Every piece is a sentence."*
   - *"We don't dress the crowd."*
   - *"We dress the individual."*
4. **FounderSection** — photo, name, title, 3-paragraph bio
5. **Stats** — `12 Drops · 40,000+ Units Sold · 80 Countries · Zero Restocks`

---

### SIZE GUIDE PAGE (`/size-guide`)

1. **Measurement how-to** — illustrated guide (SVG or image): how to measure chest, waist, hip, inseam
2. **Size tables** — tabbed: Tops / Bottoms / Outerwear / Accessories
3. Tab between `CM` and `INCHES`
4. Fit notes: *"Our tops run true to size. If between sizes, size up."*

---

### SEARCH PAGE (`/search`)

Powered by Algolia InstantSearch.

- Search bar (pre-filled with query)
- Result count: "Showing 12 results for 'black hoodie'"
- Product grid (same ProductCard)
- Filter sidebar (same as /shop)
- No results: suggestions for other terms + featured products

---

### 404 PAGE

- Full dark screen
- Giant `"404"` Archivo Black — with glitch CSS animation
- Sub-text: *"This page dropped and never restocked."*
- [GO HOME] primary button
- [VIEW SHOP] secondary button
- Background: subtle animated noise texture

---

## 11. PRODUCT EXPERIENCE (APPLE-LEVEL SHOWCASE)

These techniques elevate the product page to flagship level.

### A. Scroll-Triggered Product Storytelling
On the PDP (below the fold), add an Apple-style scroll feature section:

```
[Full bleed section — dark background]
As user scrolls:
  Image appears from fade-up →
  Text animates in from left →
  
  "180GSM. Cold-washed.
   Preshrunk.
   Built to outlast the trend."

Next scroll section:
  Detail image of stitching fills frame →
  Callout lines animate in, pointing to:
  → "Double-stitched collar"
  → "Flatlock seams"
  → "Woven REDOX label"
```

Implementation: GSAP ScrollTrigger with `scrub: true` pinning.

### B. Product Image Zoom
- On desktop: hover over PDP main image → cursor becomes `zoom-in` custom cursor → image zooms 2× in-place (CSS transform-origin follows cursor position)
- On mobile: pinch-to-zoom via native gesture

### C. Quick Add (from ProductCard)
- Hover a ProductCard → "QUICK ADD" pill appears at bottom of image
- Click → mini popover opens above card: "Select Size: XS S M L XL"
- Click size → immediately adds to cart, triggers cart icon animation (bounce + count increment), shows toast: "Added to bag ✓"
- Entire interaction completes without navigating away

### D. 360° View (optional for hero products)
- Button on PDP image: [360° VIEW]
- Drag left/right to rotate product (pre-rendered image sequence)
- Library: `@photo-sphere-viewer/core` or custom image sequence player

### E. Custom Cursor
On desktop only:
- Default: thin circle, white, 16px
- Hover over product image: circle expands to 40px with "VIEW" text inside
- Hover over CTA button: circle becomes red
- Hover over link: circle squishes

### F. Color Variant Image Switching
- Click a color swatch → main image INSTANTLY switches to that color's images
- Transition: `opacity` crossfade, 200ms
- URL updates to reflect variant: `/products/tee-001?color=black`

### G. Sticky Add to Cart Bar
When user scrolls past the AddToCart button on PDP:
- A sticky bar appears at the bottom of the screen (mobile) or top (desktop)
- Shows: product name + selected size + price + [ADD TO CART] button
- Disappears if user scrolls back up past original button

---

## 12. UI DESIGN SYSTEM

### Button Variants
```
primary:    --color-red bg, white text, red-glow shadow on hover
secondary:  transparent bg, --color-border border, white text → red border on hover
ghost:      transparent, no border, text underlines on hover
dark:       --color-surface bg, white text, surface-2 on hover
```

### Badge System
```
NEW:        --color-surface-3 bg, white text
SALE:       --color-red bg, white text
LIMITED:    black bg, white text, dashed border
SOLD OUT:   muted bg, muted text
COMING SOON: --color-void bg, --color-steel border, steel text
```

### Input States
```
default:    --color-surface bg, --color-border border
focus:      --color-border-light border, subtle glow
error:      --color-error border, error message below
success:    --color-in-stock border, checkmark icon
disabled:   opacity 0.4
```

### Skeleton Loading
Product cards show skeleton placeholders (animated shimmer) while fetching:
```css
.skeleton {
  background: linear-gradient(
    90deg,
    var(--color-surface) 25%,
    var(--color-surface-2) 50%,
    var(--color-surface) 75%
  );
  background-size: 200% 100%;
  animation: shimmer 1.5s infinite;
}

@keyframes shimmer {
  0% { background-position: 200% 0; }
  100% { background-position: -200% 0; }
}
```

---

## 13. ANIMATION & MOTION

### CSS Tokens

```css
:root {
  --ease-out:       cubic-bezier(0.16, 1, 0.3, 1);
  --ease-in-out:    cubic-bezier(0.76, 0, 0.24, 1);
  --ease-spring:    cubic-bezier(0.34, 1.56, 0.64, 1);  /* bouncy spring */
  --duration-snap:   150ms;   /* micro interactions */
  --duration-fast:   250ms;   /* hover transitions */
  --duration-normal: 450ms;   /* entrance animations */
  --duration-slow:   700ms;   /* page transitions */
  --duration-crawl:  1200ms;  /* scroll storytelling */
}

@keyframes fadeUp {
  from { opacity: 0; transform: translateY(28px); }
  to   { opacity: 1; transform: translateY(0); }
}

@keyframes fadeIn {
  from { opacity: 0; }
  to   { opacity: 1; }
}

@keyframes slideInRight {
  from { opacity: 0; transform: translateX(32px); }
  to   { opacity: 1; transform: translateX(0); }
}

@keyframes cartBounce {
  0%   { transform: scale(1); }
  40%  { transform: scale(1.3); }
  70%  { transform: scale(0.9); }
  100% { transform: scale(1); }
}

@keyframes glitch {
  0%   { transform: translate(0); }
  20%  { transform: translate(-3px, 2px); clip-path: inset(20% 0 30% 0); }
  40%  { transform: translate(3px, -2px); clip-path: inset(50% 0 20% 0); }
  60%  { transform: translate(-2px, 3px); }
  80%  { transform: translate(2px, -1px); }
  100% { transform: translate(0); }
}
```

### Key Animated Moments
| Moment | Animation |
|---|---|
| Page load | Hero text slides up + fades in (stagger per word) |
| Scroll into section | `fadeUp` with 80ms stagger per card |
| Product image hover | Second image cross-fades |
| Add to cart | Cart icon `cartBounce` + count fades in |
| Cart drawer open | Slides in from right (400ms ease-out) |
| Mobile menu open | Full-screen overlay fades+scales in |
| Size selected | Button transitions to white/dark, spring scale |
| Wishlist toggle | Heart icon scale + color pulse |
| Drop countdown | Each unit flips (CSS flip card animation) |
| 404 headline | `glitch` animation loops |
| Manifesto lines (About) | Each line fades in as user scrolls to it (GSAP) |

### `prefers-reduced-motion`
```css
@media (prefers-reduced-motion: reduce) {
  *, *::before, *::after {
    animation-duration: 0.01ms !important;
    transition-duration: 0.01ms !important;
  }
}
```

---

## 14. RESPONSIVE STRATEGY (MOBILE-FIRST)

### Breakpoints

```css
:root {
  --bp-xs:   375px;   /* Small phones */
  --bp-sm:   480px;   /* Large phones */
  --bp-md:   768px;   /* Tablets */
  --bp-lg:   1024px;  /* Small laptops */
  --bp-xl:   1280px;  /* Desktops */
  --bp-2xl:  1440px;  /* Wide screens */
}
```

### Mobile-Specific Rules

| Element | Mobile Behavior |
|---|---|
| Navbar | Logo + bag icon + hamburger only |
| Hero text | Scales down via `clamp()`, never overflows |
| PDP layout | Images carousel top, info panel full-width below |
| Product grid | 2-column (ProductCards) |
| Shop filter | Slide-up drawer, not sidebar |
| Collections hero | Reduced image height, text repositioned |
| Cart drawer | Full-screen bottom sheet style (100% width) |
| Size selector | Full-width, larger touch targets |
| [ADD TO CART] | Full-width, always visible (sticky bottom bar) |
| Reviews | 1-column cards |
| Lookbook | Single image column, 100vw images |
| Footer | Stacked columns, accordion for link groups |
| Announcement bar | Single message (no marquee on very small screens) |

### Touch Targets
- ALL buttons: minimum `48×48px`
- Size selector buttons: `44×44px` minimum
- Nav icons: `44×44px` hit area
- Color swatches: `36×36px` minimum
- CTA buttons: `56px` height on mobile

### iOS-Specific
- `env(safe-area-inset-bottom)` padding on sticky cart bar
- `-webkit-overflow-scrolling: touch` on carousels
- `overscroll-behavior: contain` on drawers

---

## 15. CART, WISHLIST & COMMERCE LOGIC

### Cart State (Zustand store)
```typescript
interface CartStore {
  items: CartItem[];
  isOpen: boolean;
  addItem: (product: Product, variant: Variant, qty: number) => void;
  removeItem: (variantId: string) => void;
  updateQty: (variantId: string, qty: number) => void;
  clearCart: () => void;
  openCart: () => void;
  closeCart: () => void;
  // Computed
  totalItems: number;
  subtotal: number;
  freeShippingProgress: number; // 0–100
}
```

**Cart persistence:** Hydrate from localStorage on mount. Sync to localStorage on every change. On Shopify: create a Shopify cart on first add, store `cartId` in localStorage.

**Add to Cart flow:**
1. User selects size (required — button disabled until size selected)
2. Clicks [ADD TO CART]
3. Button shows loading spinner
4. Item added to Zustand store + Shopify cart API
5. Cart drawer automatically opens
6. Cart icon bounces + updates count
7. Toast: "Added to your bag ✓"

**Checkout:**
- [CHECKOUT] button in cart drawer → redirects to Shopify-hosted checkout
- Shopify handles payment, address, confirmation

### Wishlist State (Zustand store)
```typescript
interface WishlistStore {
  items: WishlistItem[];
  addItem: (product: Product) => void;
  removeItem: (productId: string) => void;
  isWishlisted: (productId: string) => boolean;
  totalItems: number;
}
```

- Persist to localStorage
- If user is logged in: sync to account (Shopify Customer API)
- Heart icon: empty = not wishlisted, red filled = wishlisted

### Free Shipping Progress Bar
- Shows in CartDrawer below item list
- Example: threshold $100, cart subtotal $65 → shows "Add $35 more for free shipping"
- Progress bar fills red as user approaches threshold
- At $100+: bar is full green, "You've unlocked free shipping! 🎉"

### Size Selection Guard
- If user clicks [ADD TO CART] without selecting size:
  - Size selector section shakes (CSS animation)
  - Error message appears: "Please select a size"
  - Page scrolls smoothly to size selector

---

## 16. PERFORMANCE & SECURITY

### Performance Targets
- Lighthouse: ≥ 90 (Performance, Accessibility, SEO, Best Practices)
- LCP: < 2.5s
- CLS: < 0.1
- INP: < 200ms
- Core Web Vitals: all green

### Image Optimization
- ALL images via `next/image` (WebP, lazy, blur placeholder)
- Hero images: `priority` prop (no lazy load)
- Product images: square/portrait 3:4 ratio, consistent crop
- Provide multiple sizes to `srcset`: 400, 800, 1200px widths
- Cloudinary for on-the-fly transforms: resize, format, quality

### Code Splitting
- Route-based splits (automatic with Next.js App Router)
- `next/dynamic` for: CartDrawer, SizeGuideModal, ReviewSection, Lightbox
- Heavy libraries (GSAP, Algolia) loaded only where needed

### Font Loading
- `next/font` — all fonts self-hosted
- `display: swap` — text immediately visible, swapped when font loads
- Preload critical fonts (display + heading)

### Security
- **No API keys in client-side code** — Shopify Storefront token is public-scoped (read-only — safe in client), admin token stays server-only in API routes
- **CSP headers** in `next.config.ts`
- **Rate limiting** on contact, newsletter, waitlist API routes
- **Input validation:** Zod server-side on all form API routes
- **XSS protection:** Never use `dangerouslySetInnerHTML` on user-generated content
- **HTTPS only** — Vercel enforces this
- **CORS:** API routes configured to accept only own domain
- **Shopify webhook validation** — HMAC signature verified on revalidation route

---

## 17. ACCESSIBILITY (A11Y)

- Semantic HTML: `<nav>`, `<main>`, `<article>`, `<aside>`, `<section>`, `<header>`, `<footer>`
- Every `<img>` has descriptive `alt` text (product images: name + color + angle)
- Color contrast: 4.5:1 minimum for body, 3:1 for large text
- ALL interactive elements keyboard-navigable (Tab + Enter/Space)
- Cart drawer: focus trap while open
- Mobile menu: focus trap while open
- Modals: ESC key closes
- Size selector: radio button group semantics with `role="radiogroup"`
- Form fields: `<label>` with `htmlFor`, `aria-describedby` for errors
- `aria-live="polite"` on toast notifications
- Cart count: `aria-label="Cart: 3 items"`
- Screen reader text for icon-only buttons: `<span class="sr-only">Search</span>`
- Skip-to-main link at page top
- `prefers-reduced-motion` fully respected
- Color swatches: `aria-label="Color: Obsidian Black"` + `aria-pressed`

---

## 18. SEO & META

### Metadata Strategy
```typescript
// lib/metadata.ts
export const siteMeta = {
  siteName: 'Redox Design',
  siteUrl: 'https://redoxdesign.com',
  defaultTitle: 'Redox Design — Premium Streetwear & Contemporary Clothing',
  defaultDescription:
    'Redox Design crafts limited-run streetwear for those who dress with intention. Explore our collections, drops, and lookbooks.',
  defaultOgImage: '/og-image.jpg',
  twitterHandle: '@redoxdesign',
};
```

### Product SEO (PDP)
- `<title>`: `{Product Name} — {Collection} | Redox Design`
- `<meta name="description">`: product description, 155 chars
- Canonical URL for each variant
- Structured data: `Product` JSON-LD with `name`, `image`, `offers` (price, availability, SKU), `aggregateRating`

### Collection SEO
- Unique title, description, OG image per collection
- `CollectionPage` JSON-LD schema

### Technical
- `sitemap.xml` auto-generated (all products, collections, pages)
- `robots.txt`: block `/api/`, `/account/`
- Breadcrumb structured data on all product pages
- `hreflang` if launching in multiple regions

---

## 19. DEVELOPER CONVENTIONS

### Naming
- Components: PascalCase (`ProductCard.tsx`)
- CSS classes: camelCase in modules (`.productCard`, `.cardTitle`)
- Hooks: `useXxx.ts`
- Store files: `xxxx.store.ts`
- Type files: snake_case types, PascalCase interfaces
- Constants: SCREAMING_SNAKE_CASE (`FREE_SHIPPING_THRESHOLD = 100`)

### TypeScript Strict
- Enable `"strict": true` in `tsconfig.json`
- No `any` types — use proper types or `unknown`
- All API responses typed

### Component Template
```tsx
// Every component follows this pattern:
interface ComponentProps {
  // explicit typed props
}

export function Component({ prop1, prop2 }: ComponentProps) {
  // hooks at top
  // derived state
  // handlers
  // render
}
```

### Git Workflow
- Branch naming: `feat/product-card`, `fix/cart-drawer`, `chore/update-deps`
- Commit format: `feat: add quick add to ProductCard`
- PR required for all changes to `main`
- Preview deploy on every PR (Vercel)

---

## 20. BUILD & DEPLOYMENT CHECKLIST

### Pre-Launch

**Commerce**
- [ ] Shopify products synced and displaying correctly
- [ ] Add to cart works end-to-end (add → cart → checkout)
- [ ] Variant switching (size, color) works correctly
- [ ] Out-of-stock variants disabled correctly
- [ ] Free shipping threshold bar calculating correctly
- [ ] Cart persists on page refresh
- [ ] Wishlist persists on page refresh
- [ ] Checkout redirects to Shopify correctly

**UX**
- [ ] Size selector guard working (shake animation + error)
- [ ] Quick Add from ProductCard working
- [ ] Sticky AddToCart bar appears on scroll (PDP mobile)
- [ ] Cart drawer opens on add to cart
- [ ] Countdown timer counting down correctly
- [ ] Waitlist form submitting (confirm email in inbox)
- [ ] Newsletter form submitting

**Content**
- [ ] All images have correct `alt` text
- [ ] No placeholder copy remaining
- [ ] All links working
- [ ] 404 page showing correctly

**Performance**
- [ ] Lighthouse ≥ 90 all pages
- [ ] Hero images have `priority` on `next/image`
- [ ] No render-blocking resources
- [ ] GSAP/Framer Motion loaded correctly, no hydration errors

**SEO**
- [ ] All pages have unique title + description
- [ ] `sitemap.xml` generated and submitted to Google Search Console
- [ ] Product structured data valid (test with Rich Results Test)
- [ ] OG images rendering (test with opengraph.xyz)

**Security**
- [ ] No API keys in client bundle
- [ ] `.env.local` not committed
- [ ] Rate limiting on API routes
- [ ] Shopify webhook HMAC verified

**Accessibility**
- [ ] Keyboard navigation works site-wide
- [ ] No Axe DevTools errors
- [ ] Cart/menu focus traps working
- [ ] Reduced motion tested

---

## APPENDIX A — ENV EXAMPLE

```bash
# .env.example

# Shopify Storefront (PUBLIC — safe in client)
NEXT_PUBLIC_SHOPIFY_DOMAIN=redox-design.myshopify.com
NEXT_PUBLIC_SHOPIFY_STOREFRONT_TOKEN=xxxxxxxxxxxxxxxx

# Shopify Admin (PRIVATE — server only)
SHOPIFY_ADMIN_TOKEN=shpat_xxxxxxxxxxxx
SHOPIFY_WEBHOOK_SECRET=xxxxxxxxxxxx

# Site
NEXT_PUBLIC_SITE_URL=https://redoxdesign.com
NEXT_PUBLIC_FREE_SHIPPING_THRESHOLD=100

# Algolia Search
NEXT_PUBLIC_ALGOLIA_APP_ID=XXXXXXXXXX
NEXT_PUBLIC_ALGOLIA_SEARCH_KEY=xxxxxxxxxxxxxxxx

# Email (Resend)
RESEND_API_KEY=re_xxxxxxxxxxxx

# Cloudinary (images)
NEXT_PUBLIC_CLOUDINARY_CLOUD_NAME=redoxdesign
```

---

## APPENDIX B — DESIGN TOKENS QUICK REFERENCE

| Token | Value |
|---|---|
| Brand Red | `#D72638` |
| Background | `#080808` |
| Surface | `#0F0F0F` |
| Text Primary | `#EFEFEF` |
| Text Secondary | `#ABABAB` |
| Border | `#262626` |
| Low Stock | `#E8A838` |
| In Stock | `#2ECC71` |
| Font Display | Archivo Black |
| Font Heading | Barlow Condensed |
| Font Body | DM Sans |
| Font Mono | IBM Plex Mono |
| Container Max | 1440px |
| Product Image | 3:4 aspect ratio |
| CTA Height | 56px |
| Touch Target Min | 48px |
| Cart Z-index | 2000 |
| Modal Z-index | 3000 |
| Transition | 250–450ms ease-out |

---

## APPENDIX C — PAGE HIERARCHY & PRIORITY

Build in this exact order (most important first):

1. Design tokens + global CSS
2. Navbar + Footer + AnnouncementBar
3. ProductCard component (used everywhere)
4. CartDrawer + cart store
5. Homepage
6. PDP (Product Detail Page)
7. Shop page + filters
8. Collection pages
9. Drops page + countdown
10. Lookbook pages
11. About + Sustainability
12. Account pages
13. Search
14. Size Guide, Contact, 404

---

*Document: `REDOX_APPAREL_FRONTEND_STRATEGY.md` — Redox Design Apparel 2026*
*Single source of truth for the clothing brand frontend build.*
*Update this document as product decisions evolve.*
