# Inventory reference image sources

Last updated: 2026-08-07 (CEST)

The six files under `public/inventory-reference/` are original AI-generated
illustrations created for this RepairDesk inventory UI task. They are visual
placeholders for a product family, not customer uploads, product evidence,
condition evidence, or a claim that the pictured finish is the item’s actual
finish. The visible `参考图` badge is intentional.

The UI always tries the authenticated same-origin store thumbnail first. A
reference illustration is selected only when the store has no usable thumbnail
and the family matcher recognizes the model. If the local reference also fails,
the category icon remains the final fallback. No runtime third-party image
requests are made.

## Local assets

| Family | Local file | Matching examples | Output |
| --- | --- | --- | --- |
| Nintendo Switch | `/inventory-reference/switch.webp` | Nintendo/Switch | 960 × 720 WebP, quality 78, 12 KB |
| PlayStation 4 | `/inventory-reference/ps4.webp` | Sony/PlayStation + PS4 | 960 × 720 WebP, quality 78, 9.1 KB |
| PlayStation 5 | `/inventory-reference/ps5.webp` | Sony/PlayStation + PS5 | 960 × 720 WebP, quality 78, 10 KB |
| iPhone classic | `/inventory-reference/iphone-classic.webp` | iPhone 7/8/SE | 960 × 720 WebP, quality 78, 5.4 KB |
| iPhone standard | `/inventory-reference/iphone-standard.webp` | iPhone X/XR/XS/11/12/13/14 ordinary models | 960 × 720 WebP, quality 78, 9.2 KB |
| iPhone modern | `/inventory-reference/iphone-modern.webp` | Pro, 15/16/17, Air, and e models | 960 × 720 WebP, quality 78, 12 KB |

The source PNGs are retained in the generated-assets workspace; only optimized
same-origin WebP copies are served by the application. Every served file is
well below the 180 KB limit.

## Generation provenance

All six source PNGs were created in new-image mode with the built-in image
generator on 2026-08-07. No manufacturer image, website screenshot, customer
photo, or other reference image was supplied as input. The prompts requested
original, photorealistic studio catalogue renders on a neutral background,
without logos, words, watermarks, UI, people, or serial numbers. The PNGs were
then converted locally to 960 × 720 WebP at quality 78.

| Family | Source PNG SHA-256 | Served WebP SHA-256 |
| --- | --- | --- |
| Nintendo Switch | `610df986b1ad4dbeec9e6549bb39aad9d504e1a2eebd9f850ad197a892170f04` | `57d0d00099da54f1accf4a2a2e9ea9d0246d21c1421bfc542282116d4f3a9512` |
| PlayStation 4 | `c98c7cf442fdaaff08481449a757bdb37a6eb9ec13b225cb9de80a07e77f39ad` | `a01c42fb4d9ddcb5581de55fbce3be6ceea19a18b3bb1779fa74cd5651affe23` |
| PlayStation 5 | `af97d471079016b5151ca2cd954fc851a1a74b007d45d8373e41a985ce7637c4` | `d39c30c88353beb226fa591ea0cf908d5e87b5ac8ef9a6ac6d4216bc0a6ba214` |
| iPhone classic | `fd39438d71fe9ef53695894e8c2411d13e693bce9feb5adf87c6d516725937f2` | `9c5f7eaf1d38cbd599cd115f9e8edd47b6073a11f99040ea5ebd752c28f54d2a` |
| iPhone standard | `4029cc37df52c12a19dc99868c56d4fbf6295a62ba177cc2365c5d3ae89ed410` | `b556931601d468dd45ff4902f3cf2f7bcc1773e85a04cd49cf93d63f66d679e6` |
| iPhone modern | `208fec3ab1da84514493ab8f0ea9a49d55f9669e41d59baf792194d9c07b7e42` | `2b6310dfa779972c2d7aa73e9298ee7268095c836ee24a9442686ff269a617a9` |

## Naming and color verification

The matcher and color labels reuse the read-only European phone catalog in
`src/features/inventory/model/eu-phone-catalog.ts`. Chinese names, English
marketing names, and catalog ids are accepted. A matched color gets an
accessible swatch and name; an unknown value is shown as text only. A swatch
does not mean the reference illustration is a photograph of that finish.

The current 2025/2026 Apple series names and colors were checked against the
official comparison pages on 2026-08-07. The rolling catalogue still covers the
existing ten-year history; historical marketing names are not claimed to have
been re-verified in this task.

- [Apple iPhone comparison (Portugal)](https://www.apple.com/pt/iphone/compare/)
- [Apple iPhone comparison (Colombia)](https://www.apple.com/co/iphone/compare/)
- [Nintendo Switch](https://www.nintendo.com/us/gaming-systems/switch/)
- [PlayStation 4](https://www.playstation.com/en-us/ps4/)
- [PlayStation 5](https://www.playstation.com/en-us/ps5/)

These links are model/name verification sources only. No official website
images are copied, proxied, or requested at runtime.
