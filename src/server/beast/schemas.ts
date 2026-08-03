import { z } from 'zod';
import {
  BEAST_MAX_BACKUP_METERS,
  BEAST_MAX_DRIVE_METERS,
  BEAST_MAX_SPEED_MPS,
  BEAST_MAX_SPIN_DEGREES,
} from './types';

export const driveOnHeadingSchema = z.object({
  meters: z
    .number()
    .positive()
    .max(BEAST_MAX_DRIVE_METERS)
    .describe('Forward distance in meters along the current heading'),
  speed: z
    .number()
    .positive()
    .max(BEAST_MAX_SPEED_MPS)
    .optional()
    .describe(`Linear speed in m/s (max ${BEAST_MAX_SPEED_MPS})`),
});

export const spinSchema = z.object({
  degrees: z
    .number()
    .refine((v) => v !== 0, { message: 'degrees must be non-zero' })
    .refine((v) => Math.abs(v) <= BEAST_MAX_SPIN_DEGREES, {
      message: `degrees magnitude must be ≤ ${BEAST_MAX_SPIN_DEGREES}`,
    })
    .describe('Yaw change in degrees (positive = left / CCW in REP-103)'),
});

export const backUpSchema = z.object({
  meters: z
    .number()
    .positive()
    .max(BEAST_MAX_BACKUP_METERS)
    .describe('Backward distance in meters'),
  speed: z
    .number()
    .positive()
    .max(BEAST_MAX_SPEED_MPS)
    .optional()
    .describe(`Linear speed in m/s (max ${BEAST_MAX_SPEED_MPS})`),
});

export const emptyToolSchema = z.object({});

export type DriveOnHeadingArgs = z.infer<typeof driveOnHeadingSchema>;
export type SpinArgs = z.infer<typeof spinSchema>;
export type BackUpArgs = z.infer<typeof backUpSchema>;
