import {
  PDFDocument,
  PDFName,
  PDFString,
  PDFHexString,
  PDFNumber,
  rgb,
} from 'pdf-lib';
import forge from 'node-forge';
import type {
  DigitalCertificateInfo,
  SignPdfOptions,
  SignatureVerificationResult,
} from './signatureTypes';

/**
 * Generates a cryptographically secure random password using crypto.getRandomValues
 */
export function generateSecurePassword(length = 16): string {
  const chars = 'abcdefghijkmnopqrstuvwxyzABCDEFGHJKLMNPQRSTUVWXYZ23456789!@#$%&*';
  let result = '';
  if (typeof crypto !== 'undefined' && typeof crypto.getRandomValues === 'function') {
    const bytes = new Uint8Array(length);
    crypto.getRandomValues(bytes);
    for (let i = 0; i < length; i++) {
      result += chars[bytes[i] % chars.length];
    }
  } else {
    for (let i = 0; i < length; i++) {
      result += chars[Math.floor(Math.random() * chars.length)];
    }
  }
  return result;
}

/**
 * Generate a local self-signed X.509 certificate and RSA private key
 */
export function generateSelfSignedCertificate(options: {
  commonName: string;
  organization?: string;
  country?: string;
  password?: string;
}): { cert: forge.pki.Certificate; key: forge.pki.rsa.PrivateKey; p12Bytes: Uint8Array; password: string } {
  const pki = forge.pki;
  const keys = pki.rsa.generateKeyPair({ bits: 2048, workers: -1 });

  const cert = pki.createCertificate();
  cert.publicKey = keys.publicKey;
  cert.serialNumber = '01' + Math.floor(Math.random() * 1000000).toString(16);

  cert.validity.notBefore = new Date();
  cert.validity.notAfter = new Date();
  cert.validity.notAfter.setFullYear(cert.validity.notBefore.getFullYear() + 2);

  const attrs = [
    { name: 'commonName', value: forge.util.encodeUtf8(options.commonName) },
    { name: 'organizationName', value: forge.util.encodeUtf8(options.organization || 'Bireysel Sertifika') },
    { name: 'countryName', value: forge.util.encodeUtf8(options.country || 'TR') },
  ];

  cert.setSubject(attrs);
  cert.setIssuer(attrs);

  // Self-sign with SHA-256
  cert.sign(keys.privateKey, forge.md.sha256.create());

  // Generate strong random password if not supplied
  const password = options.password || generateSecurePassword(16);

  // Package to PKCS#12
  const p12Asn1 = forge.pkcs12.toPkcs12Asn1(keys.privateKey, cert, password, {
    algorithm: '3des',
  });
  const p12Der = forge.asn1.toDer(p12Asn1).getBytes();
  const p12Bytes = new Uint8Array(Buffer.from(p12Der, 'binary'));

  return { cert, key: keys.privateKey, p12Bytes, password };
}

/**
 * Parse an existing PKCS#12 / PFX certificate file
 */
export function parseP12Certificate(
  p12Bytes: Uint8Array,
  password: string = ''
): { cert: forge.pki.Certificate; key: forge.pki.rsa.PrivateKey; certInfo: DigitalCertificateInfo } {
  const der = Buffer.from(p12Bytes).toString('binary');
  const p12Asn1 = forge.asn1.fromDer(der);
  const p12 = forge.pkcs12.pkcs12FromAsn1(p12Asn1, false, password);

  let cert: forge.pki.Certificate | null = null;
  let key: forge.pki.rsa.PrivateKey | null = null;

  for (const safeContent of p12.safeContents) {
    for (const safeBag of safeContent.safeBags) {
      if (safeBag.cert && !cert) cert = safeBag.cert;
      if (safeBag.key && !key) key = safeBag.key as forge.pki.rsa.PrivateKey;
    }
  }

  if (!cert || !key) {
    throw new Error('PKCS#12 dosyasından sertifika veya özel anahtar çıkartılamadı.');
  }

  const rawCN = cert.subject.getField('CN')?.value || 'Bilinmeyen İmzalayan';
  const rawOrg = cert.subject.getField('O')?.value || '';
  const rawCountry = cert.subject.getField('C')?.value || '';
  const rawIssuer = cert.issuer.getField('CN')?.value || rawCN;

  let commonName = String(rawCN);
  try { commonName = forge.util.decodeUtf8(commonName); } catch (_) {}

  let organization = rawOrg ? String(rawOrg) : '';
  try { organization = forge.util.decodeUtf8(organization); } catch (_) {}

  let country = rawCountry ? String(rawCountry) : '';
  try { country = forge.util.decodeUtf8(country); } catch (_) {}

  let issuer = String(rawIssuer);
  try { issuer = forge.util.decodeUtf8(issuer); } catch (_) {}

  const certInfo: DigitalCertificateInfo = {
    commonName,
    organization: organization || undefined,
    country: country || undefined,
    validFrom: cert.validity.notBefore.toISOString(),
    validTo: cert.validity.notAfter.toISOString(),
    serialNumber: cert.serialNumber,
    issuer,
  };

  return { cert, key, certInfo };
}

/**
 * Sign a PDF document using detached CMS / PKCS#7 (ISO 32000-1 Adobe.PPKLite)
 */
export async function signPdf(
  pdfBytes: Uint8Array,
  options: SignPdfOptions
): Promise<Uint8Array> {
  let cert: forge.pki.Certificate;
  let key: forge.pki.rsa.PrivateKey;
  let signerName = 'Onaylayan';

  if (options.p12Bytes) {
    const parsed = parseP12Certificate(options.p12Bytes, options.p12Password || '');
    cert = parsed.cert;
    key = parsed.key;
    signerName = parsed.certInfo.commonName;
  } else if (options.selfSigned) {
    const gen = generateSelfSignedCertificate(options.selfSigned);
    cert = gen.cert;
    key = gen.key;
    signerName = options.selfSigned.commonName;
  } else {
    throw new Error('İmzalama için PKCS#12 sertifikası veya imzalayan bilgisi gereklidir.');
  }

  const doc = await PDFDocument.load(pdfBytes);
  const now = new Date();

  // Draw visual widget if requested
  if (options.visual?.showVisual) {
    const pIdx = Math.min(Math.max(0, options.visual.pageIndex || 0), doc.getPageCount() - 1);
    const page = doc.getPage(pIdx);
    const { x, y, width, height } = options.visual;

    // Visual signature stamp box
    page.drawRectangle({
      x,
      y,
      width,
      height,
      borderWidth: 1.5,
      borderColor: rgb(0.12, 0.45, 0.85),
      color: rgb(0.96, 0.98, 1.0),
    });

    page.drawText('DİJİTAL İMZA İLE TASDİKLENMİŞTİR', {
      x: x + 12,
      y: y + height - 20,
      size: 10,
      color: rgb(0.1, 0.3, 0.7),
    });

    page.drawText(`İmzalayan: ${signerName}`, {
      x: x + 12,
      y: y + height - 36,
      size: 9,
      color: rgb(0.15, 0.15, 0.15),
    });

    if (options.reason) {
      page.drawText(`Sebep: ${options.reason}`, {
        x: x + 12,
        y: y + height - 50,
        size: 8,
        color: rgb(0.35, 0.35, 0.35),
      });
    }

    const dateStr = now.toLocaleDateString('tr-TR') + ' ' + now.toLocaleTimeString('tr-TR');
    page.drawText(`Tarih: ${dateStr} (ISO 32000)`, {
      x: x + 12,
      y: y + 10,
      size: 8,
      color: rgb(0.45, 0.45, 0.45),
    });
  }

  // Signature Dictionary Placeholder
  const placeholderHexLen = 4096;
  const placeholderHex = '0'.repeat(placeholderHexLen);

  const brArr = doc.context.obj([
    PDFNumber.of(1000000000),
    PDFNumber.of(2000000000),
    PDFNumber.of(3000000000),
    PDFNumber.of(4000000000),
  ]);

  const sigDict = doc.context.obj({
    Type: 'Sig',
    Filter: 'Adobe.PPKLite',
    Subtype: 'adbe.pkcs7.detached',
    ByteRange: brArr,
    Contents: PDFHexString.of(placeholderHex),
    Reason: PDFString.of(options.reason || 'Doküman Aslı Tasdiki'),
    M: PDFString.of(`D:${now.toISOString().replace(/[-:T]/g, '').slice(0, 14)}Z`),
    Name: PDFString.of(signerName),
    Location: PDFString.of(options.location || 'Türkiye'),
  });

  const sigDictRef = doc.context.register(sigDict);

  // Set in catalog AcroForm
  const acroForm = doc.context.obj({
    Fields: [sigDictRef],
    SigFlags: 3,
  });
  doc.catalog.set(PDFName.of('AcroForm'), doc.context.register(acroForm));

  // Save PDF without object streams to ensure readable dictionary offsets
  const savedPdfBytes = await doc.save({ useObjectStreams: false });
  const pdfBuffer = Buffer.from(savedPdfBytes);
  const pdfString = pdfBuffer.toString('latin1');

  // Locate /Contents <
  const contentsMarker = '/Contents <';
  const cIndex = pdfString.indexOf(contentsMarker);
  if (cIndex === -1) throw new Error('/Contents marker not found in PDF bytes');

  const hexStartIndex = cIndex + contentsMarker.length;
  const hexEndIndex = hexStartIndex + placeholderHexLen;
  if (pdfString[hexEndIndex] !== '>') {
    throw new Error('Hex placeholder end marker not found');
  }

  // Calculate exact byte ranges
  const part1Start = 0;
  const part1Len = hexStartIndex - 1; // up to and including '<'
  const part2Start = hexEndIndex + 1; // right after '>'
  const part2Len = savedPdfBytes.length - part2Start;

  // Format replacement ByteRange array string
  const n0 = String(part1Start).padStart(10, '0');
  const n1 = String(part1Len).padStart(10, '0');
  const n2 = String(part2Start).padStart(10, '0');
  const n3 = String(part2Len).padStart(10, '0');

  const oldRangePattern = '[ 1000000000 2000000000 3000000000 4000000000 ]';
  const newRange = `[ ${n0} ${n1} ${n2} ${n3} ]`;

  const brIndex = pdfString.indexOf(oldRangePattern);
  if (brIndex === -1) throw new Error('ByteRange placeholder pattern not found');

  pdfBuffer.write(newRange, brIndex, 'latin1');

  // Extract signed data chunks
  const chunk1 = pdfBuffer.subarray(part1Start, part1Start + part1Len);
  const chunk2 = pdfBuffer.subarray(part2Start, part2Start + part2Len);
  const dataToSign = Buffer.concat([chunk1, chunk2]);

  // Create PKCS#7 detached signature
  const p7 = forge.pkcs7.createSignedData();
  p7.content = forge.util.createBuffer(dataToSign.toString('binary'), 'raw');
  p7.addCertificate(cert);
  p7.addSigner({
    key,
    certificate: cert,
    digestAlgorithm: forge.pki.oids.sha256,
  });
  p7.sign({ detached: true });

  const der = forge.asn1.toDer(p7.toAsn1()).getBytes();
  const hexSig = forge.util.bytesToHex(der).toUpperCase();

  if (hexSig.length > placeholderHexLen) {
    throw new Error(`İmza boyutu (${hexSig.length}) ayrılan alanı (${placeholderHexLen}) aştı.`);
  }

  // Pad signature with zeros to fill placeholder
  const paddedHexSig = hexSig.padEnd(placeholderHexLen, '0');
  pdfBuffer.write(paddedHexSig, hexStartIndex, 'latin1');

  return new Uint8Array(pdfBuffer);
}

/**
 * Verify signatures in a PDF document
 */
export async function verifyPdfSignatures(
  pdfBytes: Uint8Array
): Promise<SignatureVerificationResult[]> {
  const pdfBuffer = Buffer.from(pdfBytes);
  const pdfString = pdfBuffer.toString('latin1');

  const results: SignatureVerificationResult[] = [];

  // Match /ByteRange [ ... ]
  const brRegex = /\/ByteRange\s*\[\s*(\d+)\s+(\d+)\s+(\d+)\s+(\d+)\s*\]/g;
  let match: RegExpExecArray | null;

  while ((match = brRegex.exec(pdfString)) !== null) {
    const b0 = parseInt(match[1], 10);
    const b1 = parseInt(match[2], 10);
    const b2 = parseInt(match[3], 10);
    const b3 = parseInt(match[4], 10);

    try {
      // Check byte range boundaries
      if (b0 !== 0 || b1 <= 0 || b2 <= b1 || b3 <= 0 || b2 + b3 > pdfBuffer.length) {
        results.push({
          isSigned: true,
          isValid: false,
          isTampered: true,
          error: 'Geçersiz ByteRange sınırları tespit edildi.',
        });
        continue;
      }

      // Extract chunks
      const chunk1 = pdfBuffer.subarray(b0, b0 + b1);
      const chunk2 = pdfBuffer.subarray(b2, b2 + b3);
      const signedData = Buffer.concat([chunk1, chunk2]);

      // Extract signature hex between b1 and b2
      const sigSection = pdfString.slice(b1, b2);
      const hexMatch = sigSection.match(/<([0-9A-Fa-f]+)>/);
      if (!hexMatch) {
        results.push({
          isSigned: true,
          isValid: false,
          isTampered: true,
          error: 'İmza içerik verisi (Contents) okunamadı.',
        });
        continue;
      }

      const rawHex = hexMatch[1];
      const derBytes = forge.util.hexToBytes(rawHex);

      // Parse ASN.1 PKCS#7 with non-strict parsing for padded zeros
      const p7Asn1 = (forge.asn1.fromDer as any)(derBytes, { parseAllBytes: false });
      const p7 = forge.pkcs7.messageFromAsn1(p7Asn1) as any;

      if (!p7.certificates || p7.certificates.length === 0) {
        results.push({
          isSigned: true,
          isValid: false,
          isTampered: true,
          error: 'İmzada geçerli bir X.509 sertifikası bulunamadı.',
        });
        continue;
      }

      const cert = p7.certificates[0];
      const cn = cert.subject.getField('CN')?.value || 'Bilinmeyen İmzalayan';
      const org = cert.subject.getField('O')?.value || '';
      const issuer = cert.issuer.getField('CN')?.value || cn;

      const certInfo: DigitalCertificateInfo = {
        commonName: String(cn),
        organization: org ? String(org) : undefined,
        validFrom: cert.validity.notBefore.toISOString(),
        validTo: cert.validity.notAfter.toISOString(),
        serialNumber: cert.serialNumber,
        issuer: String(issuer),
      };

      // Compute digest of signed data
      const md = forge.md.sha256.create();
      md.update(signedData.toString('binary'), 'raw');

      let isValid = false;
      let isTampered = true;

      try {
        isValid = cert.publicKey.verify(md.digest().bytes(), p7.rawCapture.signature);
        isTampered = !isValid;
      } catch (_vErr) {
        isValid = false;
        isTampered = true;
      }

      // Extract Name / Reason / Location from surrounding dict
      const nameMatch = sigSection.match(/\/Name\s*\(([^)]+)\)/);
      const reasonMatch = sigSection.match(/\/Reason\s*\(([^)]+)\)/);
      const locMatch = sigSection.match(/\/Location\s*\(([^)]+)\)/);
      const mMatch = sigSection.match(/\/M\s*\(([^)]+)\)/);

      results.push({
        isSigned: true,
        isValid,
        isTampered,
        signerName: nameMatch ? nameMatch[1] : String(cn),
        reason: reasonMatch ? reasonMatch[1] : undefined,
        location: locMatch ? locMatch[1] : undefined,
        signingTime: mMatch ? mMatch[1] : undefined,
        certificate: certInfo,
        byteRange: [b0, b1, b2, b3],
      });
    } catch (err: any) {
      results.push({
        isSigned: true,
        isValid: false,
        isTampered: true,
        error: 'İmza doğrulanırken hata oluştu: ' + (err.message || String(err)),
      });
    }
  }

  return results;
}
