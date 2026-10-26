type Gender = 'male' | 'female' | 'unknown'

/** Displays a compact gender symbol when the user has chosen one. */
export function GenderMark({ gender }: { gender: Gender }) {
  if (gender === 'unknown') return null
  const isMale = gender === 'male'
  return (
    <span className={`gender-mark ${isMale ? 'is-male' : 'is-female'}`} title={isMale ? '男' : '女'}>{isMale ? '♂' : '♀'}</span>
  )
}
