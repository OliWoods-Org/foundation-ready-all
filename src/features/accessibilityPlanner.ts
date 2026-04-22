/**
 * AccessibilityPlanner — Disaster preparedness planning for people with
 * disabilities and elderly populations, addressing 2-4x mortality disparity.
 *
 * Generates personalized emergency plans accounting for mobility aids,
 * medical equipment, cognitive needs, and caregiver coordination.
 */

import { z } from 'zod';

// ─── Schemas ───────────────────────────────────────────────────────────────────

export const AccessibilityProfileSchema = z.object({
  userId: z.string().uuid(),
  age: z.number().int().min(0).max(150),
  disabilities: z.array(z.enum([
    'mobility_wheelchair', 'mobility_walker', 'mobility_cane',
    'visual_blind', 'visual_low_vision', 'hearing_deaf', 'hearing_hard',
    'cognitive_intellectual', 'cognitive_dementia', 'cognitive_autism',
    'speech', 'chronic_fatigue', 'chronic_pain',
    'respiratory', 'cardiac', 'dialysis', 'oxygen_dependent',
    'psychiatric', 'seizure_disorder', 'multiple_sclerosis',
  ])),
  mobilityLevel: z.enum(['independent', 'assisted', 'wheelchair', 'bedridden']),
  communicationMethods: z.array(z.enum([
    'verbal', 'sign_language', 'picture_board', 'text_device',
    'eye_gaze', 'gestures', 'written', 'interpreter_needed',
  ])),
  medicalEquipment: z.array(z.object({
    name: z.string(),
    requiresPower: z.boolean(),
    batteryBackupHours: z.number().nonnegative().optional(),
    weight: z.number().positive().optional(),
    portable: z.boolean(),
  })),
  medications: z.array(z.object({
    name: z.string(),
    dosage: z.string(),
    frequency: z.string(),
    refrigerated: z.boolean(),
    daysSupply: z.number().int().positive(),
    criticalIfMissed: z.boolean(),
  })),
  caregivers: z.array(z.object({
    name: z.string(),
    phone: z.string(),
    relationship: z.string(),
    livesWithUser: z.boolean(),
    availableHours: z.string().optional(),
  })),
  housing: z.object({
    type: z.enum(['house', 'apartment', 'assisted_living', 'nursing_home', 'group_home']),
    floor: z.number().int().nonnegative(),
    hasElevator: z.boolean(),
    hasRamp: z.boolean(),
    exitCount: z.number().int().positive(),
    accessibleExits: z.number().int().nonnegative(),
  }),
  transportation: z.object({
    hasAccessibleVehicle: z.boolean(),
    paratransitRegistered: z.boolean(),
    canDriveAlone: z.boolean(),
    needsWheelchairTransport: z.boolean(),
  }),
  serviceAnimal: z.object({
    has: z.boolean(),
    type: z.string().optional(),
    name: z.string().optional(),
    needs: z.array(z.string()).optional(),
  }).optional(),
});

export const EmergencyPlanSchema = z.object({
  userId: z.string().uuid(),
  generatedAt: z.string().datetime(),
  planVersion: z.number().int().positive(),
  riskLevel: z.enum(['standard', 'elevated', 'high', 'critical']),
  evacuationPlan: z.object({
    primaryRoute: z.string(),
    alternateRoute: z.string(),
    estimatedEvacuationTime: z.number().positive().describe('Minutes'),
    assistanceRequired: z.array(z.string()),
    equipmentToTake: z.array(z.string()),
    shelterNeeds: z.array(z.string()),
  }),
  shelterInPlace: z.object({
    bestRoom: z.string(),
    supplies: z.array(z.object({
      item: z.string(),
      quantity: z.number(),
      category: z.enum(['medical', 'medication', 'food', 'water', 'power', 'communication', 'comfort', 'documents']),
      critical: z.boolean(),
    })),
    powerPlan: z.string(),
    communicationPlan: z.string(),
  }),
  contactChain: z.array(z.object({
    priority: z.number().int().min(1),
    name: z.string(),
    phone: z.string(),
    role: z.string(),
    specialInstructions: z.string().optional(),
  })),
  medicalInfo: z.object({
    conditions: z.array(z.string()),
    criticalMedications: z.array(z.string()),
    allergies: z.array(z.string()),
    bloodType: z.string().optional(),
    doNotResuscitate: z.boolean().optional(),
    hospitalPreference: z.string().optional(),
  }),
  communicationCard: z.object({
    primaryLanguage: z.string(),
    communicationMethod: z.string(),
    keyPhrases: z.array(z.object({
      situation: z.string(),
      message: z.string(),
    })),
  }),
  reviewSchedule: z.object({
    nextReview: z.string(),
    frequency: z.enum(['monthly', 'quarterly', 'biannual', 'annual']),
  }),
});

export const PowerOutagePlanSchema = z.object({
  userId: z.string().uuid(),
  criticalDevices: z.array(z.object({
    device: z.string(),
    powerDraw: z.number().positive().describe('Watts'),
    batteryBackupHours: z.number().nonnegative(),
    priority: z.enum(['life_sustaining', 'critical', 'important', 'comfort']),
  })),
  totalCriticalWatts: z.number(),
  batteryRecommendation: z.object({
    minimumWh: z.number(),
    recommendedWh: z.number(),
    suggestedProducts: z.array(z.string()),
  }),
  utilityNotification: z.object({
    registeredAsMedical: z.boolean(),
    utilityCompany: z.string().optional(),
    priorityRestoration: z.boolean(),
  }),
  escalationPlan: z.array(z.object({
    hoursWithoutPower: z.number(),
    action: z.string(),
    contactNumber: z.string().optional(),
  })),
});

// ─── Types ─────────────────────────────────────────────────────────────────────

export type AccessibilityProfile = z.infer<typeof AccessibilityProfileSchema>;
export type EmergencyPlan = z.infer<typeof EmergencyPlanSchema>;
export type PowerOutagePlan = z.infer<typeof PowerOutagePlanSchema>;

// ─── Implementation ────────────────────────────────────────────────────────────

/**
 * Calculate individual risk level based on accessibility profile
 */
export function calculateRiskLevel(profile: AccessibilityProfile): EmergencyPlan['riskLevel'] {
  let riskScore = 0;

  // Mobility factors
  if (profile.mobilityLevel === 'bedridden') riskScore += 4;
  else if (profile.mobilityLevel === 'wheelchair') riskScore += 3;
  else if (profile.mobilityLevel === 'assisted') riskScore += 2;

  // Power-dependent equipment
  const powerDevices = profile.medicalEquipment.filter(e => e.requiresPower);
  riskScore += powerDevices.length * 2;

  // Critical medications
  const criticalMeds = profile.medications.filter(m => m.criticalIfMissed);
  riskScore += criticalMeds.length;
  if (profile.medications.some(m => m.refrigerated)) riskScore += 2;

  // Housing accessibility
  if (profile.housing.floor > 0 && !profile.housing.hasElevator) riskScore += 3;
  if (profile.housing.accessibleExits === 0) riskScore += 4;

  // Caregiver availability
  if (profile.caregivers.length === 0) riskScore += 3;
  if (!profile.caregivers.some(c => c.livesWithUser)) riskScore += 2;

  // Communication barriers
  if (!profile.communicationMethods.includes('verbal')) riskScore += 2;

  // Age factor
  if (profile.age >= 80) riskScore += 2;
  else if (profile.age >= 70) riskScore += 1;

  if (riskScore >= 12) return 'critical';
  if (riskScore >= 8) return 'high';
  if (riskScore >= 4) return 'elevated';
  return 'standard';
}

/**
 * Generate personalized emergency supplies list
 */
export function generateSuppliesList(
  profile: AccessibilityProfile,
  daysToSustain: number = 7
): EmergencyPlan['shelterInPlace']['supplies'] {
  const supplies: EmergencyPlan['shelterInPlace']['supplies'] = [];

  // Water — 1 gallon per person per day
  supplies.push({
    item: 'Water', quantity: daysToSustain, category: 'water', critical: true,
  });

  // Medications
  for (const med of profile.medications) {
    supplies.push({
      item: `${med.name} (${med.dosage})`,
      quantity: daysToSustain,
      category: 'medication',
      critical: med.criticalIfMissed,
    });
    if (med.refrigerated) {
      supplies.push({
        item: `Cooler/ice packs for ${med.name}`,
        quantity: 1,
        category: 'medication',
        critical: true,
      });
    }
  }

  // Power backup for medical equipment
  const powerDevices = profile.medicalEquipment.filter(e => e.requiresPower);
  if (powerDevices.length > 0) {
    supplies.push({
      item: 'Portable battery backup / generator',
      quantity: 1,
      category: 'power',
      critical: true,
    });
    supplies.push({
      item: 'Extra device batteries/chargers',
      quantity: powerDevices.length,
      category: 'power',
      critical: true,
    });
  }

  // Communication
  supplies.push({
    item: 'Charged phone with emergency contacts programmed',
    quantity: 1, category: 'communication', critical: true,
  });
  supplies.push({
    item: 'Battery-powered or hand-crank radio',
    quantity: 1, category: 'communication', critical: true,
  });

  if (profile.communicationMethods.includes('picture_board')) {
    supplies.push({
      item: 'Laminated communication board (waterproof)',
      quantity: 1, category: 'communication', critical: true,
    });
  }

  // Service animal
  if (profile.serviceAnimal?.has) {
    supplies.push({
      item: `Service animal food for ${profile.serviceAnimal.name ?? 'service animal'}`,
      quantity: daysToSustain, category: 'comfort', critical: true,
    });
    supplies.push({
      item: 'Service animal medications/supplies',
      quantity: 1, category: 'comfort', critical: true,
    });
  }

  // Documents
  supplies.push({
    item: 'Waterproof copies of: medical records, insurance, IDs, prescriptions',
    quantity: 1, category: 'documents', critical: true,
  });

  // Food
  supplies.push({
    item: 'Non-perishable food (easy to prepare)',
    quantity: daysToSustain * 3, category: 'food', critical: true,
  });

  return supplies;
}

/**
 * Generate complete personalized emergency plan
 */
export function generateEmergencyPlan(
  profile: AccessibilityProfile,
  medicalInfo: EmergencyPlan['medicalInfo']
): EmergencyPlan {
  const riskLevel = calculateRiskLevel(profile);
  const supplies = generateSuppliesList(profile);

  // Evacuation planning
  const needsAssistance: string[] = [];
  if (profile.mobilityLevel !== 'independent') {
    needsAssistance.push(`Mobility assistance: ${profile.mobilityLevel} — requires ${
      profile.mobilityLevel === 'bedridden' ? 'stretcher/carry assistance' :
      profile.mobilityLevel === 'wheelchair' ? 'wheelchair-accessible transport' : 'walking support'
    }`);
  }
  if (!profile.communicationMethods.includes('verbal')) {
    needsAssistance.push(`Communication: uses ${profile.communicationMethods.join(', ')}`);
  }

  const portableEquipment = profile.medicalEquipment
    .filter(e => e.portable)
    .map(e => e.name);
  const nonPortableEquipment = profile.medicalEquipment
    .filter(e => !e.portable)
    .map(e => e.name);

  const evacuationTime = profile.mobilityLevel === 'bedridden' ? 45
    : profile.mobilityLevel === 'wheelchair' ? 20
    : profile.mobilityLevel === 'assisted' ? 15
    : 10;

  // Shelter needs
  const shelterNeeds: string[] = [];
  if (profile.mobilityLevel === 'wheelchair') shelterNeeds.push('ADA-accessible shelter');
  if (profile.medicalEquipment.some(e => e.requiresPower)) shelterNeeds.push('Shelter with power outlets');
  if (profile.medications.some(m => m.refrigerated)) shelterNeeds.push('Refrigeration for medications');
  if (profile.disabilities.includes('hearing_deaf')) shelterNeeds.push('Visual alert systems');
  if (profile.disabilities.includes('visual_blind')) shelterNeeds.push('Audible alert systems');
  if (profile.serviceAnimal?.has) shelterNeeds.push('Service animal accommodations');

  // Contact chain
  const contactChain = profile.caregivers.map((c, i) => ({
    priority: i + 1,
    name: c.name,
    phone: c.phone,
    role: c.relationship,
    specialInstructions: c.livesWithUser ? 'Lives with user — primary evacuation assistant' : undefined,
  }));

  // Communication card
  const keyPhrases: EmergencyPlan['communicationCard']['keyPhrases'] = [
    { situation: 'Medical emergency', message: `I have ${medicalInfo.conditions.join(', ')}. I need ${medicalInfo.criticalMedications.join(', ')}.` },
    { situation: 'Evacuation needed', message: `I need ${needsAssistance.length > 0 ? needsAssistance[0] : 'assistance evacuating'}.` },
    { situation: 'Shelter arrival', message: `I require: ${shelterNeeds.join(', ')}` },
  ];

  const powerPlan = profile.medicalEquipment.some(e => e.requiresPower)
    ? `Priority: maintain power for ${profile.medicalEquipment.filter(e => e.requiresPower).map(e => e.name).join(', ')}. Battery backup: ${profile.medicalEquipment.filter(e => e.requiresPower).reduce((max, e) => Math.min(max, e.batteryBackupHours ?? 0), Infinity)} hours minimum. Register as life-support customer with utility.`
    : 'No power-dependent medical equipment. Standard emergency power preparations.';

  return {
    userId: profile.userId,
    generatedAt: new Date().toISOString(),
    planVersion: 1,
    riskLevel,
    evacuationPlan: {
      primaryRoute: `Exit ${profile.housing.accessibleExits > 0 ? 'via accessible exit' : 'requires assistance — no accessible exit identified'}`,
      alternateRoute: profile.housing.exitCount > 1 ? 'Secondary exit available' : 'CRITICAL: Only one exit — request fire department pre-plan visit',
      estimatedEvacuationTime: evacuationTime,
      assistanceRequired: needsAssistance,
      equipmentToTake: [...portableEquipment, ...profile.medications.filter(m => m.criticalIfMissed).map(m => m.name)],
      shelterNeeds,
    },
    shelterInPlace: {
      bestRoom: 'Interior room on lowest accessible floor with access to bathroom and power',
      supplies,
      powerPlan,
      communicationPlan: `Primary: phone. Backup: ${profile.communicationMethods.filter(m => m !== 'verbal').join(', ') || 'written notes'}. Emergency: 911 text-to-911 if available.`,
    },
    contactChain,
    medicalInfo,
    communicationCard: {
      primaryLanguage: 'en',
      communicationMethod: profile.communicationMethods[0],
      keyPhrases,
    },
    reviewSchedule: {
      nextReview: new Date(Date.now() + 90 * 86400000).toISOString().split('T')[0],
      frequency: riskLevel === 'critical' ? 'monthly' : riskLevel === 'high' ? 'quarterly' : 'biannual',
    },
  };
}
