# Bundled font assets

OrbiAgents bundles three upstream font files under the SIL Open Font License 1.1. Their complete license texts are stored beside the binaries in `desktop/src/renderer/src/assets/fonts/`.

| Local asset | Upstream | Pinned SHA-256 |
| --- | --- | --- |
| `NotoSans-VF.ttf` | `notofonts/NotoSans` main variable TTF | `a7e136b1610b46c15e4e8a50cf36211bd3e18ebd33e2e0692294cf28b6c9099b` |
| `NotoSansArabic-VF.ttf` | `notofonts/arabic` release `NotoSansArabic-v2.013`, slim variable TTF | `c16ae8cbd93e8f2d15b5462dcb717dba11ff961efbe4610a78f566b77be820f4` |
| `NotoSansSC-VF.ttf` | `notofonts/noto-cjk` main Simplified Chinese variable TTF subset | `d68bafcb48a2707749396aa12bbbd833cb70401f3a9a689fd2902c7e0d295964` |

`check-localization-source.mjs` verifies these hashes, reviewed size limits, OFL license markers, catalog key parity, locale-specific CSS selection, and explicit Arabic RTL behavior. The application loads fonts only from its packaged files; it makes no runtime font network requests.
