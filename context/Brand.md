# Brand & Design System — Digital Gastronome

*Source: Netto-panino Stitch project*

---

## Identity

**App Name:** Netto Panino Maker
**Aesthetic:** Digital Gastronome — editorial food magazine meets clean mobile UI
**Tone:** Premium, playful, purposeful (anti-waste mission)

---

## Color Palette

| Token | Hex | Usage |
|-------|-----|-------|
| Sourdough Beige | `#fefee5` | Primary background (`BrandColors.background`) |
| Vibrant Yellow | `#fedf00` | CTA buttons, active tab (`primaryContainer`) |
| Basil Green | `#456e39` | Store badges, success (`tertiary`) |
| Tomato Red | `#be2d06` | Errors, delete (`error`) |
| Ink Black | `#373928` | Primary text, tab bar (`onSurface`) |
| Warm Gray | `#babba4` | Secondary text, inactive (`outlineVariant`) |
| Pure White | `#ffffff` | Cards, elevated surfaces (`surfaceLowest`) |
| Light Sand | `#eff0d1` | Subtle backgrounds (`surfaceHigh`) |

All tokens are in `constants/theme.ts` as `BrandColors`.

---

## Typography

| Token | Family | Weight | Usage |
|-------|--------|--------|-------|
| `headlineExtraBold` | Plus Jakarta Sans | 800 | Screen titles (34px), recipe names (28px) |
| `headlineBold` | Plus Jakarta Sans | 700 | Card titles (18–20px), section headers |
| `bodyRegular` | Be Vietnam Pro | 400 | Body copy (15–16px), prep text |
| `bodyBold` | Be Vietnam Pro | 700 | CTA labels, badges, meta text |

Fonts are loaded via `@expo-google-fonts`. Fallback to system font if not loaded.

---

## Spacing Scale (`Spacing`)

| Token | Value |
|-------|-------|
| `xs` | 4px |
| `sm` | 8px |
| `md` | 16px |
| `lg` | 24px |
| `xl` | 32px |
| `xxl` | 48px |

---

## Border Radius (`Radius`)

| Token | Value | Usage |
|-------|-------|-------|
| `sm` | 8px | Small badges |
| `md` | 12px | Checkboxes, step rows |
| `lg` | 32px | Cards (gourmet card radius) |
| `xl` | 48px | Pipeline card |
| `pill` | 9999px | CTA buttons, store badges |

---

## Components

### CTA Button (Primary)
- Background: Vibrant Yellow `#fedf00`
- Text: Ink Black, 15px, Bold, UPPERCASE, letterSpacing 2
- Height: 64px, borderRadius: pill
- Shadow: yellow glow (shadowColor: yellow, opacity 0.4, radius 16)
- Disabled: opacity 0.5, no shadow

### Complete Button (Secondary dark)
- Background: Ink Black `#373928`
- Text: Vibrant Yellow, 14px, Bold, UPPERCASE, letterSpacing 1.5
- Height: 52px, borderRadius: pill
- Appears below primary CTA when recipe is ready

### Ghost Button
- Transparent background, border: `surfaceHighest`
- Text: `outlineVariant`, 14px, Bold, UPPERCASE
- Height: 52px, borderRadius: pill
- Used for NEW SEARCH, GENERATE ANYWAY

### Recipe Card (Gourmet Card)
- Background: Pure White
- Border radius: 32px
- Shadow: `onSurface` 6% opacity, blur 24
- Header section: `surfaceHigh` background with TODAY'S SPECIAL label

### Vault Card (History Card)
- Background: Pure White, borderRadius: 32px
- Photo header: full-width 200px image (tap to expand 320px) via `expo-image`
- Body: name, store badge (Basil Green), date, ingredients, AI recipe prep
- Favourite star: Vibrant Yellow

### Store Badge
- Background: Vibrant Yellow (Today screen) or Basil Green (Vault)
- Text: 11–12px Bold
- Border radius: pill or sm

### Pipeline Step Row
- Active: `surfaceLow` background, bold label
- Complete: strikethrough label, green check circle (`tertiary`)
- Pending: default `outlineVariant` label

### Step Checklist (Upload screen)
- Checkbox: 22×22, borderRadius 6, border `surfaceHigh`
- Checked: Basil Green fill, white checkmark
- Done step: strikethrough, `outlineVariant` color
- Rows separated by hairline border

---

## Tab Bar

- Background: Ink Black `#373928`
- Active tint: Vibrant Yellow `#fedf00`
- Inactive tint: `outlineVariant`
- Height: 60px, no top border, no shadow
- Label: 10px, letterSpacing 0.5

| Tab | Label | SF Symbol |
|-----|-------|-----------|
| Today | Today | `fork.knife` |
| History | History | `archivebox.fill` |
| Capture | Capture | `camera.fill` |
| Settings | Settings | `gearshape.fill` |

---

## Screen Backgrounds

All screens: Sourdough Beige `#fefee5`
Cards / elevated surfaces: Pure White `#ffffff`

---

## Screens Overview

### Today (index.tsx)
- Sticky header: "NETTO / Panino Maker" + 🇩🇰 badge
- Content: idle → pipeline progress → recipe card
- Footer: MAKE PANINO → RE-ROLL + NEW SEARCH → + "I MADE IT — CAPTURE →" pill

### History Vault (vault.tsx)
- Header: "THE PANINO / History"
- Stats row: TOTAL / FAVOURITES / WITH PHOTO
- List of cards with full-width photos, AI recipe text, fav/delete

### Make & Capture (upload.tsx)
- Header: "MAKE & / Capture"
- Dark recipe name card (Ink Black background)
- Step checklist (white card)
- Photo zone (tap to open camera/gallery)
- SAVE TO VAULT footer button

### Automation Settings (settings.tsx)
- Weekly schedule toggles (Mon–Sun)
- Store preference
- Time picker
- Master automation toggle
