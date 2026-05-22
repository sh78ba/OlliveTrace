import { RedactionResult } from './types';

export class PiiRedactor {
  private rules = [
    { name: 'EMAIL', pattern: /[\w.-]+@[\w.-]+\.\w+/g },
    { name: 'PHONE', pattern: /(\+\d{1,2}\s?)?1?-?\.?\s?\(?\d{3}\)?[\s.-]?\d{3}[\s.-]?\d{4}/g },
    { name: 'CREDIT_CARD', pattern: /\b(?:\d[ -]*?){13,16}\b/g },
    { name: 'SSN', pattern: /\b\d{3}-\d{2}-\d{4}\b/g },
    { name: 'IPV4', pattern: /\b(?:[0-9]{1,3}\.){3}[0-9]{1,3}\b/g }
  ];

  public redact(text: string): RedactionResult {
    let redactedText = text;
    const found: string[] = [];

    for (const rule of this.rules) {
      const matches = text.match(rule.pattern);
      if (matches) {
        found.push(rule.name);
        redactedText = redactedText.replace(rule.pattern, `[REDACTED-${rule.name}]`);
      }
    }

    return {
      redacted: redactedText,
      found: [...new Set(found)] // unique values
    };
  }
}
