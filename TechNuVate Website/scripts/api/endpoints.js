// scripts/api/endpoints.js
// All NestJS API route strings in one place.
// Import these constants instead of writing path
// strings inline so a route rename is a one-line fix.

export const ENDPOINTS = {
  // Contact
  CONTACT: '/contact',

  // Donation
  DONATION_INITIALIZE: '/donation/initialize',
  DONATION_CONFIRM:    '/donation/confirm',

  // Academy
  ACADEMY_ENROLL:              '/academy/enroll',
  ACADEMY_ENROLL_CONFIRM:      '/academy/enroll/confirm',
  ACADEMY_VERIFY_PARTNER_CODE: '/academy/verify-partner-code',

  // Labs Pro
  LABS_PRO_APPLY:         '/labs/pro/apply',
  LABS_PRO_APPLY_CONFIRM: '/labs/pro/apply/confirm',

  // Labs IT
  LABS_IT_APPLY:         '/labs/it/apply',
  LABS_IT_APPLY_CONFIRM: '/labs/it/apply/confirm',

  // Studio
  STUDIO_INQUIRY: '/studio/inquiry',

  // Talent
  TUTORS_APPLY:  '/talent/tutors/apply',
  CAREERS_APPLY: '/talent/careers/apply',
};
