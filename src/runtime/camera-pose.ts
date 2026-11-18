export type Coordinates = [number, number, number]
export interface CameraPose {
  position: Coordinates
  target: Coordinates
}

export function readPose(query: URLSearchParams): CameraPose | null {
  const parts = query.get('pose')?.split(',')
  if (!parts || parts.length !== 6 || parts.some(part => !part.trim())) return null
  const values = parts.map(Number)
  if (values.some(n => !Number.isFinite(n) || Math.abs(n) > 1e7)) return null
  const [x,y,z,tx,ty,tz] = values
  if (Math.hypot(x-tx,y-ty,z-tz) < .001) return null
  return {position:[x,y,z],target:[tx,ty,tz]}
}
