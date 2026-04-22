/**
 * AlertAccessibility — Multi-modal emergency alert system
 * ensuring disabled and elderly populations receive and
 * understand emergency notifications through their preferred channels.
 */

import { z } from 'zod';

// ─── Schemas ───────────────────────────────────────────────────────────────────

export const AlertPreferenceSchema = z.object({
  userId: z.string().uuid(),
  channels: z.array(z.object({
    type: z.enum([
      'push_notification', 'sms', 'voice_call', 'email',
      'vibration', 'flashing_light', 'smart_speaker',
      'caregiver_relay', 'tty', 'video_relay',
    ]),
    priority: z.number().int().min(1),
    enabled: z.boolean(),
    config: z.record(z.string()).optional(),
  })),
  language: z.string().default('en'),
  simplifiedLanguage: z.boolean().default(false),
  largeText: z.boolean().default(false),
  highContrast: z.boolean().default(false),
  readAloud: z.boolean().default(false),
  signLanguageVideo: z.boolean().default(false),
  caregiverCopyTo: z.array(z.object({
    name: z.string(),
    phone: z.string().optional(),
    email: z.string().email().optional(),
  })).optional(),
});

export const AccessibleAlertSchema = z.object({
  id: z.string().uuid(),
  issuedAt: z.string().datetime(),
  expiresAt: z.string().datetime(),
  source: z.enum(['NWS', 'FEMA', 'local_ema', 'fire', 'police', 'utility', 'community']),
  alertType: z.enum([
    'tornado', 'hurricane', 'flood', 'earthquake', 'wildfire',
    'severe_storm', 'winter_storm', 'heat_wave', 'tsunami',
    'hazmat', 'active_threat', 'amber_alert', 'power_outage',
    'water_contamination', 'evacuation_order', 'shelter_in_place',
  ]),
  severity: z.enum(['extreme', 'severe', 'moderate', 'minor']),
  area: z.object({
    description: z.string(),
    polygons: z.array(z.array(z.object({ lat: z.number(), lon: z.number() }))).optional(),
  }),
  content: z.object({
    headline: z.string(),
    standardText: z.string(),
    simplifiedText: z.string(),
    actionSteps: z.array(z.object({
      step: z.number().int().positive(),
      instruction: z.string(),
      simplifiedInstruction: z.string(),
      iconUrl: z.string().url().optional(),
    })),
    signLanguageVideoUrl: z.string().url().optional(),
    audioUrl: z.string().url().optional(),
  }),
  disabilitySpecificGuidance: z.array(z.object({
    disabilityType: z.string(),
    guidance: z.string(),
    resources: z.array(z.string()),
  })),
});

export const AlertDeliveryResultSchema = z.object({
  alertId: z.string(),
  userId: z.string().uuid(),
  deliveredAt: z.string().datetime(),
  channels: z.array(z.object({
    type: z.string(),
    status: z.enum(['delivered', 'failed', 'pending', 'acknowledged']),
    deliveredAt: z.string().datetime().optional(),
    acknowledgedAt: z.string().datetime().optional(),
    failureReason: z.string().optional(),
  })),
  caregiverNotified: z.boolean(),
  acknowledged: z.boolean(),
  escalated: z.boolean(),
});

// ─── Types ─────────────────────────────────────────────────────────────────────

export type AlertPreference = z.infer<typeof AlertPreferenceSchema>;
export type AccessibleAlert = z.infer<typeof AccessibleAlertSchema>;
export type AlertDeliveryResult = z.infer<typeof AlertDeliveryResultSchema>;

// ─── Implementation ────────────────────────────────────────────────────────────

/**
 * Adapt an alert for a user's accessibility preferences
 */
export function adaptAlertForUser(
  alert: AccessibleAlert,
  prefs: AlertPreference
): {
  text: string;
  channels: string[];
  includesVideo: boolean;
  includesAudio: boolean;
  fontSize: 'normal' | 'large' | 'x-large';
} {
  const text = prefs.simplifiedLanguage
    ? alert.content.simplifiedText
    : alert.content.standardText;

  const enabledChannels = prefs.channels
    .filter(c => c.enabled)
    .sort((a, b) => a.priority - b.priority)
    .map(c => c.type);

  return {
    text,
    channels: enabledChannels,
    includesVideo: prefs.signLanguageVideo && !!alert.content.signLanguageVideoUrl,
    includesAudio: prefs.readAloud && !!alert.content.audioUrl,
    fontSize: prefs.largeText ? 'x-large' : 'normal',
  };
}

/**
 * Create simplified, plain-language version of alert text
 */
export function simplifyAlertText(
  text: string,
  maxSyllablesPerWord: number = 3,
  maxWordsPerSentence: number = 15
): string {
  const simplifications: Record<string, string> = {
    'evacuate': 'leave now',
    'precipitation': 'rain or snow',
    'meteorological': 'weather',
    'approximately': 'about',
    'immediately': 'right now',
    'hazardous': 'dangerous',
    'subsequently': 'then',
    'contamination': 'poison',
    'infrastructure': 'roads and buildings',
    'commence': 'start',
    'facilitate': 'help',
    'deteriorate': 'get worse',
    'accumulation': 'buildup',
    'anticipate': 'expect',
    'significant': 'big',
    'utilize': 'use',
    'residence': 'home',
    'vegetation': 'plants',
    'inundation': 'flooding',
    'dissipate': 'go away',
  };

  let simplified = text;
  for (const [complex, simple] of Object.entries(simplifications)) {
    simplified = simplified.replace(new RegExp(complex, 'gi'), simple);
  }

  // Break long sentences
  const sentences = simplified.split(/[.!?]+/).filter(s => s.trim());
  const shortSentences = sentences.map(sentence => {
    const words = sentence.trim().split(/\s+/);
    if (words.length <= maxWordsPerSentence) return sentence.trim();

    const chunks: string[] = [];
    for (let i = 0; i < words.length; i += maxWordsPerSentence) {
      chunks.push(words.slice(i, i + maxWordsPerSentence).join(' '));
    }
    return chunks.join('. ');
  });

  return shortSentences.join('. ').replace(/\.\s*\./g, '.') + '.';
}

/**
 * Generate disability-specific guidance for an alert type
 */
export function generateDisabilityGuidance(
  alertType: AccessibleAlert['alertType']
): AccessibleAlert['disabilitySpecificGuidance'] {
  const guidance: AccessibleAlert['disabilitySpecificGuidance'] = [];

  const mobilityGuidance: Record<string, string> = {
    tornado: 'Move to lowest interior room. If unable to transfer from wheelchair, position away from windows and cover with blankets/mattress.',
    earthquake: 'Lock wheelchair brakes. Cover head and neck. If in bed, stay and cover with pillow.',
    flood: 'Move to highest accessible floor immediately. Do not attempt to cross moving water in wheelchair.',
    wildfire: 'Begin evacuation early — do not wait for mandatory order. Pre-position go bag at accessible exit.',
    evacuation_order: 'Activate evacuation assistance plan. Contact paratransit provider immediately.',
  };

  const sensoryGuidance: Record<string, string> = {
    tornado: 'If deaf/hard of hearing: monitor weather radio with vibrating alert or visual strobe. Pair with hearing buddy if available.',
    earthquake: 'If blind/low vision: after shaking stops, use walls to navigate. Expect objects on floor. Call out for help.',
    flood: 'Visual flood indicators: look for water stains on curbs, listen for rushing water, feel for wet ground.',
  };

  if (mobilityGuidance[alertType]) {
    guidance.push({
      disabilityType: 'Mobility impairment',
      guidance: mobilityGuidance[alertType],
      resources: ['Local paratransit emergency line', '211 for evacuation assistance'],
    });
  }

  if (sensoryGuidance[alertType]) {
    guidance.push({
      disabilityType: 'Sensory impairment',
      guidance: sensoryGuidance[alertType],
      resources: ['711 TRS relay service', 'FEMA Disability Integration Specialist: 800-621-3362'],
    });
  }

  guidance.push({
    disabilityType: 'Cognitive/developmental',
    guidance: 'Use simple, direct language. Follow your emergency picture schedule. Go to your safe place. Wait for your helper.',
    resources: ['Crisis text line: text HOME to 741741', '988 Suicide & Crisis Lifeline'],
  });

  guidance.push({
    disabilityType: 'Oxygen/power dependent',
    guidance: `Switch to battery backup immediately. Conserve power. Contact utility for priority restoration. If battery under 4 hours, call 911.`,
    resources: ['Utility emergency priority list', '911 for life-sustaining equipment failure'],
  });

  return guidance;
}

/**
 * Determine escalation path when alert acknowledgment is not received
 */
export function determineEscalation(
  alert: AccessibleAlert,
  delivery: AlertDeliveryResult,
  minutesSinceDelivery: number
): { shouldEscalate: boolean; action: string; urgency: 'immediate' | 'soon' | 'monitor' } {
  if (delivery.acknowledged) {
    return { shouldEscalate: false, action: 'None — acknowledged', urgency: 'monitor' };
  }

  const severityThresholds = {
    extreme: 5,
    severe: 15,
    moderate: 30,
    minor: 60,
  };

  const threshold = severityThresholds[alert.severity];

  if (minutesSinceDelivery >= threshold * 3) {
    return {
      shouldEscalate: true,
      action: 'Request welfare check from local emergency services',
      urgency: 'immediate',
    };
  }

  if (minutesSinceDelivery >= threshold * 2) {
    return {
      shouldEscalate: true,
      action: 'Contact all listed caregivers and neighbors for in-person check',
      urgency: 'immediate',
    };
  }

  if (minutesSinceDelivery >= threshold) {
    return {
      shouldEscalate: true,
      action: 'Retry all channels and notify primary caregiver',
      urgency: 'soon',
    };
  }

  return { shouldEscalate: false, action: 'Pending — within normal response window', urgency: 'monitor' };
}
