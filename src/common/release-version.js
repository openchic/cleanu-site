const VERSION_PATTERN = /^(0|[1-9]\d*)\.(0|[1-9]\d*)\.(0|[1-9]\d*)$/

/** Check for a stable, canonical three-part release version. */
export function isReleaseVersion(version) {
  if (typeof version !== 'string' || VERSION_PATTERN.exec(version)?.[0] !== version) return false
  return version.split('.').every((part) => Number.isSafeInteger(Number(part)))
}

/** Compare two validated release versions numerically. */
export function compareVersions(first, second) {
  const firstParts = first.split('.').map(Number)
  const secondParts = second.split('.').map(Number)
  for (let index = 0; index < 3; index += 1) {
    const difference = firstParts[index] - secondParts[index]
    if (difference) return Math.sign(difference)
  }
  return 0
}
