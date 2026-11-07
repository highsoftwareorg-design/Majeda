/**
 * בדיקות יחידה ל-generateConsentPdf ו-saveConsentPdf — משימה 7.8 (FR-CF-08).
 *
 * כל קריאות ל-Prisma ו-Vercel Blob ממוקות — אין גישה אמיתית לבסיס הנתונים או לאחסון.
 *
 * בודק:
 * 1. generateConsentPdf מחזיר Buffer > 1KB כאשר הנתונים תקינים.
 * 2. ה-Buffer הוא PDF תקין (מתחיל ב-%PDF).
 * 3. saveConsentPdf מדלג על Blob ומחזיר 'mock-storage-key' כאשר אין BLOB_READ_WRITE_TOKEN.
 *
 * הרצה: `npx vitest run lib/consent/__tests__/pdf.test.ts`
 */

import { vi, describe, it, expect, beforeEach, afterEach } from 'vitest';

// --- Mocks (חייבים לפני ה-imports של המודולים הממוקים) ---

const { mockFindUnique, mockUpdate, mockBlobPut } = vi.hoisted(() => ({
  mockFindUnique: vi.fn(),
  mockUpdate: vi.fn(),
  mockBlobPut: vi.fn(),
}));

vi.mock('@/lib/db/prisma', () => ({
  prisma: {
    signedConsent: {
      findUnique: mockFindUnique,
      update: mockUpdate,
    },
  },
}));

vi.mock('@vercel/blob', () => ({
  put: mockBlobPut,
}));

import { generateConsentPdf } from '../pdf';
import { saveConsentPdf } from '../storage';

// --- נתוני בדיקה ---

/** רשומת SignedConsent מינימלית שמחזיר ה-mock של Prisma */
const mockConsentRecord = {
  id: 'fake-id',
  clientId: 'client-1',
  client: {
    firstName: 'שרה',
    lastName: 'לוי',
    phone: '0501234567',
  },
  template: {
    name: 'טופס הסכמה כללי',
    fields: [],
  },
  fieldValues: { question1: 'yes' },
  signedAt: new Date('2026-01-15'),
  auditHash: 'abc123',
  auditIp: null,
  signatureClientData: null,
};

// --- בדיקות ---

describe('generateConsentPdf (משימה 7.8)', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockFindUnique.mockResolvedValue(mockConsentRecord);
  });

  it('מחזיר Buffer > 1KB כאשר הנתונים תקינים', async () => {
    const buffer = await generateConsentPdf('fake-id');

    expect(buffer).toBeInstanceOf(Buffer);
    expect(buffer.length).toBeGreaterThan(1024);
  });

  it('ה-Buffer הוא PDF תקין — מתחיל ב-%PDF', async () => {
    const buffer = await generateConsentPdf('fake-id');

    // PDF files always begin with the magic bytes %PDF
    const header = buffer.slice(0, 4).toString('ascii');
    expect(header).toBe('%PDF');
  });

  it('לא זורק שגיאה כאשר signatureClientData הוא null', async () => {
    // signatureClientData=null is the default in mockConsentRecord
    await expect(generateConsentPdf('fake-id')).resolves.toBeInstanceOf(Buffer);
  });

  it('זורק שגיאה כאשר SignedConsent לא נמצא', async () => {
    mockFindUnique.mockResolvedValue(null);

    await expect(generateConsentPdf('nonexistent-id')).rejects.toThrow(
      'SignedConsent not found: nonexistent-id'
    );
  });
});

describe('saveConsentPdf (משימה 7.8)', () => {
  let savedToken: string | undefined;

  beforeEach(() => {
    vi.clearAllMocks();
    savedToken = process.env.BLOB_READ_WRITE_TOKEN;
  });

  afterEach(() => {
    // Restore BLOB_READ_WRITE_TOKEN to its original value after each test
    if (savedToken === undefined) {
      delete process.env.BLOB_READ_WRITE_TOKEN;
    } else {
      process.env.BLOB_READ_WRITE_TOKEN = savedToken;
    }
  });

  it('מדלג על Vercel Blob ומחזיר mock-storage-key כאשר אין BLOB_READ_WRITE_TOKEN', async () => {
    delete process.env.BLOB_READ_WRITE_TOKEN;
    mockFindUnique.mockResolvedValue(mockConsentRecord);

    const result = await saveConsentPdf('fake-id');

    expect(result).toBe('mock-storage-key');
    // Vercel Blob put must NOT have been called
    expect(mockBlobPut).not.toHaveBeenCalled();
  });

  it('לא קורא ל-generateConsentPdf כאשר מדלג על אחסון (BLOB_READ_WRITE_TOKEN חסר)', async () => {
    delete process.env.BLOB_READ_WRITE_TOKEN;
    // prisma.signedConsent.findUnique should NOT be called in the skip path
    mockFindUnique.mockResolvedValue(mockConsentRecord);

    await saveConsentPdf('fake-id');

    // In skip mode, the function returns before calling prisma or blob
    expect(mockBlobPut).not.toHaveBeenCalled();
  });
});
