import { z } from "zod";

export const pciScoreSchema = z.union([
  z.literal(1),
  z.literal(2),
  z.literal(3),
  z.literal(4),
  z.literal(5),
]);

export const surfaceDefectTypeSchema = z.enum([
  "longitudinal_crack",
  "transverse_crack",
  "alligator_crack",
  "pothole",
  "shoulder_settlement",
  "ditch_flooding",
  "erosion",
]);

export const surfaceDefectSchema = z.object({
  type: surfaceDefectTypeSchema,
  severity: pciScoreSchema,
  locationHint: z.string().min(1),
  evidenceNote: z.string().min(1).optional(),
  lat: z.number().min(-90).max(90).optional(),
  lng: z.number().min(-180).max(180).optional(),
  relativeX: z.number().min(0).max(1).optional(),
  relativeY: z.number().min(0).max(1).optional(),
  alongRoad: z.number().min(0).max(1).optional(),
  relativeW: z.number().min(0.02).max(0.5).optional(),
  relativeH: z.number().min(0.02).max(0.5).optional(),
});

export const roadAnalysisResultSchema = z.object({
  pciScore: pciScoreSchema,
  surfaceDefects: z.array(surfaceDefectSchema),
  conditionDescription: z.string().min(1),
  probableCauses: z.array(z.string().min(1)),
  recommendations: z.array(z.string().min(1)),
  potentialHazards: z.array(z.string().min(1)),
  confidenceScore: z.number().min(0).max(1),
});

export type RoadAnalysisResultParsed = z.infer<typeof roadAnalysisResultSchema>;
