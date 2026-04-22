/**
 * CommunityResilience — Neighborhood-level disability-inclusive disaster
 * preparedness mapping and mutual aid coordination.
 *
 * Maps vulnerable populations, coordinates volunteer networks,
 * and generates disability-inclusive community emergency plans.
 */

import { z } from 'zod';

// ─── Schemas ───────────────────────────────────────────────────────────────────

export const VulnerabilityMapSchema = z.object({
  regionId: z.string(),
  regionName: z.string(),
  bounds: z.object({
    north: z.number(), south: z.number(),
    east: z.number(), west: z.number(),
  }),
  generatedAt: z.string().datetime(),
  totalPopulation: z.number().int().positive(),
  vulnerablePopulation: z.number().int().nonnegative(),
  demographics: z.object({
    elderly65Plus: z.number().int().nonnegative(),
    disabilityAny: z.number().int().nonnegative(),
    mobilityImpaired: z.number().int().nonnegative(),
    sensorImpaired: z.number().int().nonnegative(),
    cognitiveImpaired: z.number().int().nonnegative(),
    medicallyFragile: z.number().int().nonnegative(),
    languageBarrier: z.number().int().nonnegative(),
    noVehicle: z.number().int().nonnegative(),
  }),
  infrastructure: z.object({
    accessibleShelters: z.number().int().nonnegative(),
    totalShelters: z.number().int().nonnegative(),
    hospitalBeds: z.number().int().nonnegative(),
    paratransitVehicles: z.number().int().nonnegative(),
    backupGenerators: z.number().int().nonnegative(),
  }),
  riskScore: z.number().min(0).max(100),
  gapAnalysis: z.array(z.object({
    gap: z.string(),
    severity: z.enum(['critical', 'major', 'moderate', 'minor']),
    affectedCount: z.number().int().nonnegative(),
    recommendation: z.string(),
  })),
});

export const VolunteerNetworkSchema = z.object({
  networkId: z.string().uuid(),
  regionId: z.string(),
  volunteers: z.array(z.object({
    id: z.string().uuid(),
    name: z.string(),
    skills: z.array(z.enum([
      'cpr_first_aid', 'sign_language', 'wheelchair_transfer',
      'medical_professional', 'mental_health', 'ham_radio',
      'generator_operation', 'vehicle_driver', 'accessible_vehicle',
      'multilingual', 'crisis_counseling', 'pet_animal_care',
    ])),
    availability: z.enum(['24_7', 'daytime', 'evenings', 'weekends', 'on_call']),
    canHost: z.boolean(),
    maxPeopleToAssist: z.number().int().positive(),
    location: z.object({ latitude: z.number(), longitude: z.number() }),
    languages: z.array(z.string()),
    backgroundChecked: z.boolean(),
    trainedDate: z.string().optional(),
  })),
  assignments: z.array(z.object({
    volunteerId: z.string().uuid(),
    assignedUserId: z.string().uuid(),
    role: z.string(),
    priority: z.number().int().min(1),
  })),
  coverageScore: z.number().min(0).max(100),
});

export const MutualAidRequestSchema = z.object({
  id: z.string().uuid(),
  requestedAt: z.string().datetime(),
  requesterId: z.string().uuid(),
  urgency: z.enum(['life_threatening', 'urgent', 'important', 'routine']),
  needType: z.enum([
    'evacuation_assistance', 'medical_equipment_power', 'medication_delivery',
    'wellness_check', 'shelter_transport', 'communication_relay',
    'pet_care', 'meal_delivery', 'emotional_support',
  ]),
  location: z.object({ latitude: z.number(), longitude: z.number() }),
  description: z.string(),
  accessibilityNeeds: z.array(z.string()),
  status: z.enum(['open', 'matched', 'in_progress', 'completed', 'cancelled']),
  matchedVolunteerId: z.string().uuid().optional(),
  estimatedArrival: z.number().positive().optional().describe('Minutes'),
});

// ─── Types ─────────────────────────────────────────────────────────────────────

export type VulnerabilityMap = z.infer<typeof VulnerabilityMapSchema>;
export type VolunteerNetwork = z.infer<typeof VolunteerNetworkSchema>;
export type MutualAidRequest = z.infer<typeof MutualAidRequestSchema>;

// ─── Implementation ────────────────────────────────────────────────────────────

/**
 * Calculate community vulnerability risk score
 */
export function calculateCommunityRisk(
  demographics: VulnerabilityMap['demographics'],
  infrastructure: VulnerabilityMap['infrastructure'],
  totalPopulation: number
): { riskScore: number; gaps: VulnerabilityMap['gapAnalysis'] } {
  const gaps: VulnerabilityMap['gapAnalysis'] = [];
  let riskScore = 0;

  // Vulnerable population ratio
  const vulnerableRatio = (demographics.elderly65Plus + demographics.disabilityAny) / totalPopulation;
  riskScore += vulnerableRatio * 30;

  // Shelter accessibility gap
  if (infrastructure.totalShelters > 0) {
    const accessibleRatio = infrastructure.accessibleShelters / infrastructure.totalShelters;
    if (accessibleRatio < 0.5) {
      riskScore += 15;
      gaps.push({
        gap: 'Insufficient accessible shelters',
        severity: accessibleRatio < 0.25 ? 'critical' : 'major',
        affectedCount: demographics.mobilityImpaired,
        recommendation: `Upgrade ${infrastructure.totalShelters - infrastructure.accessibleShelters} shelters to ADA compliance`,
      });
    }
  } else {
    riskScore += 20;
    gaps.push({
      gap: 'No emergency shelters in region',
      severity: 'critical',
      affectedCount: totalPopulation,
      recommendation: 'Establish at least 1 accessible shelter per 5,000 population',
    });
  }

  // Transport gap
  if (demographics.noVehicle > infrastructure.paratransitVehicles * 20) {
    riskScore += 15;
    gaps.push({
      gap: 'Insufficient paratransit capacity for evacuation',
      severity: 'major',
      affectedCount: demographics.noVehicle,
      recommendation: `Need ${Math.ceil(demographics.noVehicle / 20) - infrastructure.paratransitVehicles} additional paratransit vehicles`,
    });
  }

  // Medical fragility without backup power
  if (demographics.medicallyFragile > infrastructure.backupGenerators * 10) {
    riskScore += 10;
    gaps.push({
      gap: 'Medically fragile residents exceed backup power capacity',
      severity: 'critical',
      affectedCount: demographics.medicallyFragile,
      recommendation: 'Distribute portable battery stations to power-dependent residents',
    });
  }

  // Communication gap
  if (demographics.sensorImpaired > 0 || demographics.languageBarrier > 0) {
    gaps.push({
      gap: 'Communication barriers during emergencies',
      severity: demographics.sensorImpaired + demographics.languageBarrier > 100 ? 'major' : 'moderate',
      affectedCount: demographics.sensorImpaired + demographics.languageBarrier,
      recommendation: 'Implement multi-modal alerts: visual, audible, vibrotactile, and multilingual',
    });
    riskScore += 10;
  }

  return { riskScore: Math.min(100, Math.round(riskScore)), gaps };
}

/**
 * Match mutual aid requests to available volunteers
 */
export function matchVolunteerToRequest(
  request: MutualAidRequest,
  network: VolunteerNetwork
): { volunteerId: string; matchScore: number; estimatedMinutes: number } | null {
  const candidates = network.volunteers
    .filter(v => {
      // Check availability
      if (request.urgency === 'life_threatening' && v.availability !== '24_7' && v.availability !== 'on_call') return false;
      return true;
    })
    .map(v => {
      let score = 50;

      // Distance scoring (rough km estimate)
      const dLat = (v.location.latitude - request.location.latitude) * 111;
      const dLon = (v.location.longitude - request.location.longitude) * 111 * Math.cos(request.location.latitude * Math.PI / 180);
      const distKm = Math.sqrt(dLat * dLat + dLon * dLon);
      score += Math.max(0, 30 - distKm * 3);

      // Skill matching
      if (request.needType === 'evacuation_assistance' && v.skills.includes('wheelchair_transfer')) score += 20;
      if (request.needType === 'medical_equipment_power' && v.skills.includes('generator_operation')) score += 20;
      if (request.needType === 'communication_relay' && v.skills.includes('sign_language')) score += 20;
      if (request.needType === 'emotional_support' && v.skills.includes('crisis_counseling')) score += 20;
      if (v.skills.includes('medical_professional')) score += 10;
      if (v.backgroundChecked) score += 5;

      const estimatedMinutes = Math.round(distKm * 3 + 5);

      return { volunteerId: v.id, matchScore: Math.min(100, score), estimatedMinutes };
    })
    .sort((a, b) => b.matchScore - a.matchScore);

  return candidates[0] ?? null;
}

/**
 * Calculate network coverage score for a region
 */
export function calculateCoverageScore(
  network: VolunteerNetwork,
  vulnerableCount: number
): number {
  if (vulnerableCount === 0) return 100;

  const totalCapacity = network.volunteers.reduce((sum, v) => sum + v.maxPeopleToAssist, 0);
  const coverageRatio = totalCapacity / vulnerableCount;

  const skillDiversity = new Set(network.volunteers.flatMap(v => v.skills)).size;
  const skillBonus = Math.min(20, skillDiversity * 2);

  const has24_7 = network.volunteers.filter(v => v.availability === '24_7' || v.availability === 'on_call').length;
  const availabilityBonus = Math.min(15, has24_7 * 3);

  const baseScore = Math.min(65, coverageRatio * 65);

  return Math.min(100, Math.round(baseScore + skillBonus + availabilityBonus));
}
