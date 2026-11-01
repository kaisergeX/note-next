# Google Sans

Source: [Google Fonts](https://github.com/google/fonts/tree/main/ofl/googlesans),
Google Sans v14.000 (upstream commit `5c8f512c5fb42a7be099b951a7c097f96209c78e`).
Downloaded on 2026-11-01. See OFL.txt and TRADEMARKS.md for licensing.

The normal and italic WOFF2 files retain variable weights 400–700 and Latin,
Latin Extended, Vietnamese, combining marks, and common punctuation/symbols.
FontTools 4.68.0 and Brotli 1.2.1 were used to instantiate the unused `GRAD`
and `opsz` axes at their defaults (0 and 18), subset, and compress the originals:
`GoogleSans[GRAD,opsz,wght].ttf` and `GoogleSans-Italic[GRAD,opsz,wght].ttf`.

Subset Unicode ranges:

```text
U+0000-024F,U+0300-036F,U+1E00-1EFF,U+2000-206F,U+20A0-20CF,U+2100-214F,U+2190-21FF,U+2212,U+2215,U+2C60-2C7F,U+A720-A7FF,U+FEFF,U+FFFD
```

`next/font/local` computes the Arial fallback metrics from these files. This
avoids the missing Google Sans entry in Next.js's Google Fonts metrics table
while retaining automatic fallback adjustment. Preloading remains disabled.
