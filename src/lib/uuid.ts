/**
 * UUID v4. Uses crypto.randomUUID() when available (modern browsers/Node 19+),
 * otherwise falls back to getRandomValues for older environments.
 */
export function randomUUID(): string {
  if (typeof crypto !== 'undefined' && typeof (crypto as Crypto).randomUUID === 'function') {
    return (crypto as Crypto).randomUUID()
  }
  const buf = new Uint8Array(16)
  crypto.getRandomValues(buf)
  buf[6] = (buf[6]! & 0x0f) | 0x40
  buf[8] = (buf[8]! & 0x3f) | 0x80
  const hex = [...buf].map((b) => b!.toString(16).padStart(2, '0')).join('')
  return `${hex.slice(0, 8)}-${hex.slice(8, 12)}-${hex.slice(12, 16)}-${hex.slice(16, 20)}-${hex.slice(20)}`
}
