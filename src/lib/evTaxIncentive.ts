/**
 * EV tax incentive tracker: eligible miles/dates for federal/state credits.
 * Stub for MVP; extend with actual rules (e.g. IRS 30D, state rebates).
 */

export interface EVIncentiveEligibility {
  federalCredits: { name: string; eligible: boolean; note: string }[]
  stateCredits: { name: string; eligible: boolean; note: string }[]
  businessMilesYTD: number
  suggestedAction: string
}

export function getEVIncentiveSummary(businessMilesYTD: number, vehicleYear?: number): EVIncentiveEligibility {
  const federalCredits = [
    { name: 'IRC 30D (Clean vehicle credit)', eligible: (vehicleYear ?? new Date().getFullYear()) >= 2023, note: 'Check income and MSRP limits.' },
    { name: 'Commercial clean vehicle credit', eligible: businessMilesYTD > 0, note: 'Business use may qualify for commercial credit.' },
  ]
  const stateCredits = [
    { name: 'State rebate/credit', eligible: true, note: 'Varies by state; link to state DMV or energy office.' },
  ]
  return {
    federalCredits,
    stateCredits,
    businessMilesYTD,
    suggestedAction: businessMilesYTD > 0
      ? 'Export mileage log for tax records and consult a CPA for EV credits.'
      : 'Track business miles to support potential commercial EV credit.',
  }
}
