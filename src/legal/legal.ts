import docs from './documents.json';

/**
 * The privacy policy and terms (App Store round 2). One source, documents.json, feeds both the
 * in-app pages and the public web pages Apple asks for (scripts/build-legal-pages.mjs writes
 * docs/privacy.html, docs/terms.html and docs/support.html for GitHub Pages).
 */
export type LegalDoc = 'privacy' | 'terms';

export interface LegalSection {
  heading: string;
  items: string[];
}

export interface LegalPage {
  title: string;
  intro: string;
  sections: LegalSection[];
}

export const LEGAL_UPDATED: string = docs.updated;
export const CONTACT = docs.contact;

/** Public addresses, for App Store Connect and the links in the app. */
export const LEGAL_SITE = 'https://m33m00.github.io/OutBound';
export const LEGAL_URL: Record<LegalDoc | 'support', string> = {
  privacy: `${LEGAL_SITE}/privacy.html`,
  terms: `${LEGAL_SITE}/terms.html`,
  support: `${LEGAL_SITE}/support.html`,
};

export function legalPage(doc: LegalDoc): LegalPage {
  return docs[doc];
}

export function parseLegalDoc(raw: unknown): LegalDoc | null {
  return raw === 'privacy' || raw === 'terms' ? raw : null;
}

/** Where people get help: the support email when one is set, else the support page. */
export function supportLink(): string {
  return CONTACT.email ? `mailto:${CONTACT.email}` : CONTACT.supportUrl;
}
