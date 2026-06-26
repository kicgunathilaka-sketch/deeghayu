export const Role = {
  SUPER_ADMIN: 'SUPER_ADMIN',
  ADMIN: 'ADMIN',
  PRESIDENT: 'PRESIDENT',
  VICE_PRESIDENT: 'VICE_PRESIDENT',
  SECRETARY: 'SECRETARY',
  TREASURER: 'TREASURER',
  COMMITTEE_MEMBER: 'COMMITTEE_MEMBER',
  MEMBER: 'MEMBER',
} as const;
export type Role = (typeof Role)[keyof typeof Role];

export const MemberStatus = {
  PENDING: 'PENDING',
  ACTIVE: 'ACTIVE',
  INACTIVE: 'INACTIVE',
  SUSPENDED: 'SUSPENDED',
  DECEASED: 'DECEASED',
} as const;
export type MemberStatus = (typeof MemberStatus)[keyof typeof MemberStatus];

export const PaymentType = {
  MONTHLY_MEETING: 'MONTHLY_MEETING',
  JOINING_FEE: 'JOINING_FEE',
  SPECIAL_MEETING: 'SPECIAL_MEETING',
  COMMUNITY_EVENT: 'COMMUNITY_EVENT',
  VOLUNTEER_EVENT: 'VOLUNTEER_EVENT',
  RELIGIOUS_EVENT: 'RELIGIOUS_EVENT',
  OTHER: 'OTHER',
  CUSTOM: 'CUSTOM',
} as const;
export type PaymentType = (typeof PaymentType)[keyof typeof PaymentType];

export const PaymentStatus = {
  PAID: 'PAID',
  PENDING: 'PENDING',
  OVERDUE: 'OVERDUE',
  PARTIAL: 'PARTIAL',
  WAIVED: 'WAIVED',
} as const;
export type PaymentStatus = (typeof PaymentStatus)[keyof typeof PaymentStatus];

export const AttendanceStatus = {
  PRESENT: 'PRESENT',
  LATE: 'LATE',
  ABSENT: 'ABSENT',
} as const;
export type AttendanceStatus = (typeof AttendanceStatus)[keyof typeof AttendanceStatus];

export const EventStatus = {
  DRAFT: 'DRAFT',
  PUBLISHED: 'PUBLISHED',
  ONGOING: 'ONGOING',
  COMPLETED: 'COMPLETED',
  CANCELLED: 'CANCELLED',
} as const;
export type EventStatus = (typeof EventStatus)[keyof typeof EventStatus];

export const EventCategory = {
  MONTHLY_MEETING: 'MONTHLY_MEETING',
  SPECIAL_MEETING: 'SPECIAL_MEETING',
  COMMUNITY_EVENT: 'COMMUNITY_EVENT',
  VOLUNTEER_EVENT: 'VOLUNTEER_EVENT',
  RELIGIOUS_EVENT: 'RELIGIOUS_EVENT',
  OTHER: 'OTHER',
} as const;
export type EventCategory = (typeof EventCategory)[keyof typeof EventCategory];

export const NotificationType = {
  EMAIL: 'EMAIL',
  IN_APP: 'IN_APP',
  BOTH: 'BOTH',
} as const;
export type NotificationType = (typeof NotificationType)[keyof typeof NotificationType];

export const RsvpResponse = {
  GOING: 'GOING',
  NOT_GOING: 'NOT_GOING',
  MAYBE: 'MAYBE',
} as const;
export type RsvpResponse = (typeof RsvpResponse)[keyof typeof RsvpResponse];

export const VoteType = {
  ANONYMOUS: 'ANONYMOUS',
  PUBLIC: 'PUBLIC',
} as const;
export type VoteType = (typeof VoteType)[keyof typeof VoteType];

export const VoteStatus = {
  DRAFT: 'DRAFT',
  ACTIVE: 'ACTIVE',
  CLOSED: 'CLOSED',
} as const;
export type VoteStatus = (typeof VoteStatus)[keyof typeof VoteStatus];
