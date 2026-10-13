# Design rules

Every screen follows these. They come from a study of Hevy, Strong, Fitbod, MuscleWiki, Nike Training Club, Apple Fitness, Ladder, Caliber, JEFIT and openGym, plus Apple's HIG and Material 3 (sources in the plan doc, "Redesign").

## Structure
- One job per screen, one primary button. On Today that is the workout; it sits right under the header.
- Top of a screen: title left, profile button right. Then the hero block. At most 3 blocks above the fold.
- Content is grouped into `Section`s: a 1-3 word title (h2), optional action on the right, content 12 below. Sections are 32 apart.
- Same kind of items → a list (`ListRow`). Mixed content → cards. Never a card inside a card.
- Long or occasional content (instructions, tips, explanations) goes behind a `Fold`.

## Words
- No paragraphs on cards. A card is a title (1-4 words), one meta line (6 words or fewer, parts separated by " · ") and at most one action.
- Numbers carry the information: big number, small unit, short label (`Tile`).
- No bold inside sentences. Bold is for titles and numbers only.
- Sentence case. No exclamation marks. No "Unleash", "Elevate", "Journey to".

## Visuals
- Every row and tile starts with an icon in a tinted square (`IconBox`). Ionicons only, one style.
- One accent colour. Blue = water, pink = protein/food, warm orange = streak/warnings, green = done. Nothing decorative in other colours.
- Spacing scale only: 4, 8, 12, 16, 24, 32 (`sp` in theme.ts). Page gutter 12, card padding 16.
- Card radius 16 everywhere (`r.lg`), smaller inside cards. Surfaces: page `c.bg`, card `c.card`, inset `c.card2`.
- Type: display 34 (screen titles), h1 28 (hero titles), h2 22 (section titles), h3 17 (card titles), body 16, small 14, label 13 caps (short eyebrows only).
- Left-align text. Centre only hero numbers and empty states.
- Touch targets 44 px or more.

## Building blocks (src/ui.tsx)
`Section`, `Tile`, `IconBox`, `ListRow`, `Banner`, `Fold`, `Card`, `Button`, `Chip`, `T`.
