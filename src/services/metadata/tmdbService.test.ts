import { describe, expect, it } from 'vitest';
import { extractSource } from './tmdbService';
import type { SubscriptionSourceConfig } from '@/services/subscriptions/subscriptionSourcesService';

describe('extractSource', () => {
  it('suggests the first provider marked as a subscription', () => {
    const providers = {
      results: {
        GB: {
          flatrate: [{ provider_name: 'Apple TV Plus' }, { provider_name: 'Netflix' }],
        },
      },
    };
    const subscriptions: SubscriptionSourceConfig = {
      'Apple TV+': false,
      Netflix: true,
    };

    expect(extractSource(providers, 'GB', subscriptions)).toBe('Netflix');
  });

  it('skips disabled providers across subscription, rental, and purchase offers', () => {
    const providers = {
      results: {
        GB: {
          flatrate: [{ provider_name: 'Apple TV Plus' }],
          rent: [{ provider_name: 'Amazon Prime Video' }],
          buy: [{ provider_name: 'Netflix' }],
        },
      },
    };
    const subscriptions: SubscriptionSourceConfig = {
      'Apple TV+': false,
      'Amazon Prime Video': true,
      Netflix: false,
    };

    expect(extractSource(providers, 'GB', subscriptions)).toBe('Amazon Prime Video');
  });

  it('returns no suggestion when no provider is enabled', () => {
    const providers = {
      results: {
        GB: {
          flatrate: [{ provider_name: 'Apple TV Plus' }],
        },
      },
    };

    expect(extractSource(providers, 'GB', {})).toBeUndefined();
  });
});
