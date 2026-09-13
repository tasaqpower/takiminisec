import { applyPermanentRedaction } from './redaction.ts';

export type EntityType = 'tckn' | 'iban' | 'creditCard' | 'phone' | 'email';

export interface DetectedEntity {
  id: string;
  type: EntityType;
  label: string;
  value: string;
  maskedValue: string;
  page: number;
  rect: { x: number; y: number; width: number; height: number };
  selected: boolean;
}

export function validateTckn(tcknStr: string): boolean {
  if (!tcknStr || tcknStr.length !== 11) return false;
  if (!/^[1-9][0-9]{10}$/.test(tcknStr)) return false;

  const d = tcknStr.split('').map(Number);

  const oddSum = d[0] + d[2] + d[4] + d[6] + d[8];
  const evenSum = d[1] + d[3] + d[5] + d[7];
  const tenth = ((oddSum * 7) - evenSum) % 10;
  const tenthCorrect = (tenth + 10) % 10;
  if (d[9] !== tenthCorrect) return false;

  const sum10 = d.slice(0, 10).reduce((acc, v) => acc + v, 0);
  if (d[10] !== (sum10 % 10)) return false;

  return true;
}

export function validateIban(ibanStr: string): boolean {
  const clean = ibanStr.replace(/[\s.-]/g, '').toUpperCase();
  if (!/^TR[0-9]{24}$/.test(clean)) return false;

  const rearranged = clean.slice(4) + '2927' + clean.slice(2, 4);
  let remainder = 0;
  for (let i = 0; i < rearranged.length; i++) {
    remainder = (remainder * 10 + parseInt(rearranged[i], 10)) % 97;
  }
  return remainder === 1;
}

export function validateCreditCard(cardStr: string): boolean {
  const clean = cardStr.replace(/[\s.-]/g, '');
  if (!/^[0-9]{13,19}$/.test(clean)) return false;

  let sum = 0;
  let shouldDouble = false;
  for (let i = clean.length - 1; i >= 0; i--) {
    let digit = parseInt(clean[i], 10);
    if (shouldDouble) {
      digit *= 2;
      if (digit > 9) digit -= 9;
    }
    sum += digit;
    shouldDouble = !shouldDouble;
  }
  return sum % 10 === 0;
}

export function maskEntityValue(type: EntityType, value: string): string {
  const clean = value.trim();
  switch (type) {
    case 'tckn':
      return clean.length === 11 ? `${clean.slice(0, 3)}*****${clean.slice(8)}` : '*** TCKN ***';
    case 'iban':
      return clean.length >= 8 ? `${clean.slice(0, 4)} **** **** ${clean.slice(-4)}` : '*** IBAN ***';
    case 'creditCard':
      return clean.length >= 8 ? `**** **** **** ${clean.slice(-4)}` : '*** KART ***';
    case 'phone':
      return clean.length >= 6 ? `${clean.slice(0, 4)} *** ** ${clean.slice(-2)}` : '*** TELEFON ***';
    case 'email': {
      const parts = clean.split('@');
      if (parts.length === 2) {
        const u = parts[0];
        const maskedU = u.length > 2 ? `${u[0]}***${u[u.length - 1]}` : `${u[0]}***`;
        return `${maskedU}@${parts[1]}`;
      }
      return '***@***.***';
    }
  }
}

export async function scanPdfForSensitiveEntities(pdfBytes: Uint8Array): Promise<DetectedEntity[]> {
  if (typeof (Promise as any).withResolvers === 'undefined') {
    (Promise as any).withResolvers = function () {
      let resolve: any, reject: any;
      const promise = new Promise((res, rej) => {
        resolve = res;
        reject = rej;
      });
      return { promise, resolve, reject };
    };
  }

  const isNode = typeof window === 'undefined';
  let pdfjsLib: any;
  if (isNode) {
    pdfjsLib = await import('pdfjs-dist/legacy/build/pdf.mjs');
  } else {
    pdfjsLib = await import('pdfjs-dist');
    if (!pdfjsLib.GlobalWorkerOptions.workerSrc) {
      pdfjsLib.GlobalWorkerOptions.workerSrc = '/pdf.worker.min.mjs';
    }
  }

  const doc = await pdfjsLib.getDocument({ data: pdfBytes.slice(0) }).promise;
  const detected: DetectedEntity[] = [];

  for (let p = 1; p <= doc.numPages; p++) {
    const page = await doc.getPage(p);
    const viewport = page.getViewport({ scale: 1 });
    const textContent = await page.getTextContent();
    const items = textContent.items as any[];

    for (let i = 0; i < items.length; i++) {
      const item = items[i];
      if (!item.str || !item.transform) continue;

      const str = item.str;
      const [scaleX, , , scaleY, tx, ty] = item.transform;
      const [vx, vy] = viewport.convertToViewportPoint(tx, ty);
      const itemW = Math.abs(item.width || item.str.length * Math.abs(scaleX) * 0.6);
      const itemH = Math.abs(item.height || Math.abs(scaleY));
      const itemY = vy - itemH;

      const rect = {
        x: Math.max(0, vx - 2),
        y: Math.max(0, itemY - 2),
        width: itemW + 4,
        height: itemH + 4
      };

      const tcknMatches = str.match(/\b[1-9][0-9]{10}\b/g) || [];
      for (const m of tcknMatches) {
        if (validateTckn(m)) {
          detected.push({
            id: `tckn_${p}_${i}_${m}`,
            type: 'tckn',
            label: 'T.C. Kimlik No',
            value: m,
            maskedValue: maskEntityValue('tckn', m),
            page: p - 1,
            rect,
            selected: true
          });
        }
      }

      const ibanMatches = str.match(/\bTR[0-9]{2}\s?(?:[0-9]{4}\s?){5}[0-9]{2}\b/gi) || [];
      for (const m of ibanMatches) {
        if (validateIban(m)) {
          detected.push({
            id: `iban_${p}_${i}_${m}`,
            type: 'iban',
            label: 'Banka IBAN',
            value: m,
            maskedValue: maskEntityValue('iban', m),
            page: p - 1,
            rect,
            selected: true
          });
        }
      }

      const cardMatches = str.match(/\b(?:4[0-9]{12}(?:[0-9]{3})?|5[1-5][0-9]{14}|6(?:011|5[0-9]{2})[0-9]{12}|3[47][0-9]{13})\b/g) || [];
      for (const m of cardMatches) {
        if (validateCreditCard(m)) {
          detected.push({
            id: `card_${p}_${i}_${m}`,
            type: 'creditCard',
            label: 'Kredi / Banka Kartı',
            value: m,
            maskedValue: maskEntityValue('creditCard', m),
            page: p - 1,
            rect,
            selected: true
          });
        }
      }

      const phoneMatches = str.match(/\b(?:(?:\+?90\s?)|0)?5[0-9]{2}[\s.-]?[0-9]{3}[\s.-]?[0-9]{2}[\s.-]?[0-9]{2}\b/g) || [];
      for (const m of phoneMatches) {
        detected.push({
          id: `phone_${p}_${i}_${m}`,
          type: 'phone',
          label: 'Telefon Numarası',
          value: m,
          maskedValue: maskEntityValue('phone', m),
          page: p - 1,
          rect,
          selected: true
        });
      }

      const emailMatches = str.match(/\b[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}\b/g) || [];
      for (const m of emailMatches) {
        detected.push({
          id: `email_${p}_${i}_${m}`,
          type: 'email',
          label: 'E-Posta Adresi',
          value: m,
          maskedValue: maskEntityValue('email', m),
          page: p - 1,
          rect,
          selected: true
        });
      }
    }
  }

  const unique: DetectedEntity[] = [];
  const seen = new Set<string>();
  for (const ent of detected) {
    const key = `${ent.page}_${ent.value}_${Math.round(ent.rect.x)}_${Math.round(ent.rect.y)}`;
    if (!seen.has(key)) {
      seen.add(key);
      unique.push(ent);
    }
  }

  return unique;
}

export async function redactDetectedEntities(
  pdfBytes: Uint8Array,
  entities: DetectedEntity[]
): Promise<Uint8Array> {
  const selected = entities.filter(e => e.selected);
  if (selected.length === 0) return pdfBytes;

  const redactionBoxes = selected.map(e => ({
    page: e.page,
    x: e.rect.x,
    y: e.rect.y,
    width: e.rect.width,
    height: e.rect.height,
    color: '#000000'
  }));

  return await applyPermanentRedaction(pdfBytes, redactionBoxes);
}
