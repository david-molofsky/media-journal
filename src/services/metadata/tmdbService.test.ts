import { describe, expect, it } from 'vitest';
import { extractSource } from './tmdbService';

describe('extractSource', () => {
  it('skips excluded providers and suggests the next available subscription service', () => {
    const providers = {
      results: {
        GB: {
          flatrate: [{ provider_name: 'Apple TV Plus' }, { provider_name: 'Netflix' }],
        },
      },
    };

    expect(extractSource(providers, 'GB', ['Apple TV+'])).toBe('Netflix');
  });

  it('uses rental or purchase providers if every subscription provider is excluded', () => {
    const providers = {
      results: {
        GB: {
          flatrate: [{ provider_name: 'Apple TV Plus' }],
          rent: [{ provider_name: 'Amazon Prime Video' }],
          buy: [{ provider_name: 'Netflix' }],
        },
      },
    };

    expect(extractSource(providers, 'GB', ['Apple TV+', 'Amazon Prime Video'])).toBe(
      'Netflix',
    );
  });

  it('matches exclusions without depending on provider name casing', () => {
    const providers = {
      results: {
        GB: {
          flatrate: [{ provider_name: 'Disney Plus' }, { provider_name: 'Netflix' }],
        },
      },
    };

    expect(extractSource(providers, 'GB', ['disney plus'])).toBe('Netflix');
  });

  it('returns no suggestion when all providers are excluded', () => {
    const providers = {
      results: {
        GB: {
          flatrate: [{ provider_name: 'Apple TV Plus' }],
        },
      },
    };

    expect(extractSource(providers, 'GB', ['apple tv+'])).toBeUndefined();
  });
});
