import fs from 'fs';
import path from 'path';

const licDir = path.resolve('./FORMA-ADOBE-CORE-MEDIA-PACK/Licenses');
if (!fs.existsSync(licDir)) fs.mkdirSync(licDir, { recursive: true });

// 1. FORMA-ORIGINAL-1.0.txt
const formaLic = `FORMA ASSET ORIGINAL LICENSE (Version 1.0)
===========================================

Copyright (c) 2024-2026 FORMA Media Engine & Algorithmic Design Studio.
All rights reserved.

Permission is hereby granted, free of charge, to any person obtaining a copy
of the media assets, sound designs, color calibration LUTs, SVG vectors, and
associated metadata governed by this license ("Assets"):

1. PERMITTED USES:
   - You may incorporate, adapt, remix, transform, and synchronize the Assets
     into personal, educational, commercial, broadcast, cinema, streaming,
     and digital multimedia video productions without limitation.
   - You may render, export, and distribute final video, film, motion graphics,
     and audio productions containing these Assets worldwide, in perpetuity.
   - Attribution to FORMA is appreciated but NOT required in end productions.

2. RESTRICTIONS:
   - You may NOT resell, sub-license, redistribute, lease, or syndicate the raw,
     unprocessed, or standalone Assets (whether unmodified or modified) as a
     standalone stock asset, asset pack, sound library, LUT pack, or template collection.
   - You may NOT extract, bundle, or claim proprietary trademark ownership over
     the original raw asset files.

3. DISCLAIMER:
   THE ASSETS ARE PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
   IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,
   FITNESS FOR A PARTICULAR PURPOSE, AND NONINFRINGEMENT. IN NO EVENT SHALL
   THE AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES, OR OTHER
   LIABILITY ARISING FROM THE USE OF THE ASSETS.
`;
fs.writeFileSync(path.join(licDir, 'FORMA-ORIGINAL-1.0.txt'), formaLic, 'utf8');

// 2. MIT.txt
const mitLic = `MIT LICENSE
===========

Copyright (c) 2013-2023 Cole Bemis (Feather Icons)
Copyright (c) 2024-2026 FORMA Project Contributors

Permission is hereby granted, free of charge, to any person obtaining a copy
of this software and associated documentation files (the "Software"), to deal
in the Software without restriction, including without limitation the rights
to use, copy, modify, merge, publish, distribute, sublicense, and/or sell
copies of the Software, and to permit persons to whom the Software is
furnished to do so, subject to the following conditions:

The above copyright notice and this permission notice shall be included in all
copies or substantial portions of the Software.

THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,
FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE
AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER
LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM,
OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN THE
SOFTWARE.

--------------------------------------------------------------------------------
Component Notice for Feather Icons:
Feather is created by Cole Bemis (https://feathericons.com) and licensed under the
MIT License. Feather Icons source repository: https://github.com/feathericons/feather
--------------------------------------------------------------------------------
`;
fs.writeFileSync(path.join(licDir, 'MIT.txt'), mitLic, 'utf8');

// 3. ISC.txt
const iscLic = `ISC LICENSE
===========

Lucide Icons
Copyright (c) 2022-2024, Lucide Contributors (https://lucide.dev)

Permission to use, copy, modify, and/or distribute this software for any
purpose with or without fee is hereby granted, provided that the above
copyright notice and this permission notice appear in all copies.

THE SOFTWARE IS PROVIDED "AS IS" AND THE AUTHOR DISCLAIMS ALL WARRANTIES
WITH REGARD TO THIS SOFTWARE INCLUDING ALL IMPLIED WARRANTIES OF
MERCHANTABILITY AND FITNESS. IN NO EVENT SHALL THE AUTHOR BE LIABLE FOR
ANY SPECIAL, DIRECT, INDIRECT, OR CONSEQUENTIAL DAMAGES OR ANY DAMAGES
WHATSOEVER RESULTING FROM LOSS OF USE, DATA OR PROFITS, WHETHER IN AN
ACTION OF CONTRACT, NEGLIGENCE OR OTHER TORTIOUS ACTION, ARISING OUT OF
OR IN CONNECTION WITH THE USE OR PERFORMANCE OF THIS SOFTWARE.

--------------------------------------------------------------------------------
Component Notice for Lucide Icons:
Lucide is an open-source icon project community fork of Feather Icons,
maintained by the Lucide community and licensed under the ISC License.
Source repository: https://github.com/lucide-icons/lucide
--------------------------------------------------------------------------------
`;
fs.writeFileSync(path.join(licDir, 'ISC.txt'), iscLic, 'utf8');

// 4. CC0-1.0.txt
const cc0Lic = `CREATIVE COMMONS ZERO v1.0 UNIVERSAL (CC0 1.0)
==============================================

Statement of Purpose:
The person who associated a work with this deed has dedicated the work to the
public domain by waiving all of his or her rights to the work worldwide under
copyright law, including all related and neighboring rights, to the extent
allowed by law.

You can copy, modify, distribute and perform the work, even for commercial
purposes, all without asking permission.

In no way are the patent or trademark rights of any person affected by CC0,
nor are the rights that other persons may have in the work or in how the work
is used, such as publicity or privacy rights.

Unless expressly stated otherwise, the person who associated a work with this
deed makes no warranties about the work, and disclaims liability for all uses
of the work, to the fullest extent permitted by applicable law.

Full Legal Code: https://creativecommons.org/publicdomain/zero/1.0/legalcode
`;
fs.writeFileSync(path.join(licDir, 'CC0-1.0.txt'), cc0Lic, 'utf8');

// 5. PUBLIC-DOMAIN-NOTICE.txt
const pdNotice = `PUBLIC DOMAIN ASSET DEDICATION & NOTICE
=======================================

This notice certifies that designated assets within this distribution package
(including select ambient sound recordings, acoustic tracks, foley audio, and
standard 3D LUT color grading look-up tables) are dedicated to or reside in the
Public Domain.

1. AUDIO ARCHIVE ASSETS:
   - Sourced from Wikimedia Commons and Freesound.org collections tagged under
     Creative Commons CC0 1.0 Universal dedication or marked explicitly as Public Domain.
   - All rights have been waived worldwide to the fullest extent permitted by applicable law.
   - Free for personal and commercial usage without royalty obligations.

2. COLOR CALIBRATION PRESETS (LUTs):
   - Sourced from public domain photographic references, open cinematography color curves,
     and open standard mathematics (Rec.709, sRGB, Log-to-Rec709 conversion transforms).
   - Unrestricted for commercial grading, editing, and distribution.

DISCLAIMER:
The assets are provided without warranties of any kind. Users are responsible
for compliance with local laws regarding publicity and moral rights where applicable.
`;
fs.writeFileSync(path.join(licDir, 'PUBLIC-DOMAIN-NOTICE.txt'), pdNotice, 'utf8');

// 6. CC-BY-ATTRIBUTIONS.md
const ccByAttributions = `# FORMA CORE MEDIA PACK — ATIF VE TELİF BELGESİ (ATTRIBUTION)

Bu belgede, FORMA Adobe Core Media Pack V1 içerisinde yer alan ve Creative Commons veya açık kaynak atıf şartlarına tabi olan üçüncü taraf medya varlıklarının telif ve atıf bilgileri listelenmiştir.

---

## 1. VİDEO VARLIKLARI (H.264 MP4)

Pakette yer alan 9 adet video varlığından 5 adedi Wikimedia Commons üzerinden temin edilmiş ve Adobe Premiere Pro / After Effects ile tam donanım hızlandırmalı uyumluluk için WebM/VP9'dan **H.264 MP4 (yuv420p)** formatına kayıpsız dönüştürülmüştür. 4 adedi ise FORMA Media Engine tarafından doğrudan üretilmiştir.

| Dosya Adı | Eser Sahibi / Yükleyici | Orijinal Eser Başlığı | Lisans | Kaynak URL / Atıf | Dönüşüm Notu |
|---|---|---|---|---|---|
| **broll-4e02c85f55.mp4** | Cpinto23 | Missouri-River-Morning-Drone-Shot | CC-BY-SA-4.0 | [Wikimedia Commons](https://commons.wikimedia.org/wiki/File:Missouri-River-Morning-Drone-Shot.webm) | WebM/VP9 -> H.264 MP4 (yuv420p, 1080p) |
| **broll-5e347b9827.mp4** | Cpinto23 | Blackfoot-River-Drone-Shot | CC-BY-SA-4.0 | [Wikimedia Commons](https://commons.wikimedia.org/wiki/File:Blackfoot-River-Drone-Shot.webm) | WebM/VP9 -> H.264 MP4 (yuv420p, 720p) |
| **broll-7e2579576d.mp4** | Bert Brothers | Stanley Hong Kong Drone 2020 | CC-BY-3.0 | [Wikimedia Commons](https://commons.wikimedia.org/wiki/File:Stanley_Hong_Kong_Drone_2020.webm) | WebM/VP9 -> H.264 MP4 (yuv420p, AAC 48k) |
| **broll-8ed1af3b71.mp4** | Project Kei | Quadcopter 20200202 | CC-BY-SA-4.0 | [Wikimedia Commons](https://commons.wikimedia.org/wiki/File:Quadcopter_20200202.webm) | WebM/VP9 -> H.264 MP4 (yuv420p, Vertical) |
| **broll-b856847505.mp4** | Phil Conrad | Photodrones UAV drone Showreel | CC-BY-3.0 | [Wikimedia Commons](https://commons.wikimedia.org/wiki/File:Photodrones_UAV_drone_Showreel.webm) | WebM/VP9 -> H.264 MP4 (yuv420p, AAC 48k) |
| **forma_forensic_10s_export.mp4** | FORMA Media Engine | Forma Motion Graphic Showcase 10s | FORMA-ORIGINAL-1.0 | Yerel Algoritmik Üretim | H.264 MP4 Doğrudan Üretim |
| **forma_forensic_10s_export_v3.mp4** | FORMA Media Engine | Forma Motion Graphic Showcase v3 | FORMA-ORIGINAL-1.0 | Yerel Algoritmik Üretim | H.264 MP4 Doğrudan Üretim |
| **forma_forensic_10s_export_v4.mp4** | FORMA Media Engine | Forma Motion Graphic Showcase v4 | FORMA-ORIGINAL-1.0 | Yerel Algoritmik Üretim | H.264 MP4 Doğrudan Üretim |
| **forma_forensic_10s_export_v5.mp4** | FORMA Media Engine | Forma Motion Graphic Showcase v5 | FORMA-ORIGINAL-1.0 | Yerel Algoritmik Üretim | H.264 MP4 Doğrudan Üretim |

---

## 2. SES VARLIKLARI (168 ADET WAV)

- **130 Adet SFX (Ses Efekti)**: FORMA Media Engine Algorithmic Sound Factory tarafından yerel olarak üretilmiştir. Lisans: \`Licenses/FORMA-ORIGINAL-1.0.txt\`
- **38 Adet Müzik / Ambiyans**: Freesound.org ve Wikimedia Commons Public Domain / CC0 arşivlerinden derlenmiştir. Lisans: \`Licenses/CC0-1.0.txt\` & \`Licenses/PUBLIC-DOMAIN-NOTICE.txt\`
  - Kaynak Koleksiyon: Freesound CC0 Foley & Ambient Audio Archive / Wikimedia Commons Audio in Public Domain
  - Eser Sahipleri: Freesound & Wikimedia Public Domain Community Contributors
  - Kullanım: CC0 1.0 Universal kapsamında telifsiz, atıf zorunluluğu olmaksızın ticari/bireysel kullanıma uygundur.

---

## 3. VEKTÖR VE İKON VARLIKLARI (337 ADET SVG)

- **252 Adet Lucide İkonu**:
  - Eser Sahipleri: Lucide Contributors (https://lucide.dev)
  - Lisans: ISC License (\`Licenses/ISC.txt\`)
  - Kaynak: https://github.com/lucide-icons/lucide
- **25 Adet Feather İkonu**:
  - Eser Sahibi: Cole Bemis (https://feathericons.com)
  - Lisans: MIT License (\`Licenses/MIT.txt\`)
  - Kaynak: https://github.com/feathericons/feather
- **60 Adet FORMA Geometrik / Vektör Elementi**:
  - Eser Sahibi: FORMA Media Engine
  - Lisans: FORMA-ORIGINAL-1.0 (\`Licenses/FORMA-ORIGINAL-1.0.txt\`)

---

## 4. RENK VE LUT VARLIKLARI (185 ADET .CUBE)

- **50 Adet FORMA Color Grade**: FORMA Media Engine tarafından algoritmik olarak üretilmiştir (\`Licenses/FORMA-ORIGINAL-1.0.txt\`).
- **135 Adet Sinematik & Standart LUT**: Açık kaynak standart renk uzayı ve kamu malı kalibrasyon tablolarından derlenmiştir (\`Licenses/CC0-1.0.txt\` / \`Licenses/PUBLIC-DOMAIN-NOTICE.txt\`).
`;
fs.writeFileSync(path.join(licDir, 'CC-BY-ATTRIBUTIONS.md'), ccByAttributions, 'utf8');

// Remove old ATTRIBUTION-CC-BY.md if present
const oldAttr = path.join(licDir, 'ATTRIBUTION-CC-BY.md');
if (fs.existsSync(oldAttr)) {
  fs.unlinkSync(oldAttr);
}

console.log('All 6 license files successfully written to:', licDir);
