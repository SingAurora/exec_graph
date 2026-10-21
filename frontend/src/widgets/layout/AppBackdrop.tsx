import groovyIllustration from '../../../assets/app-groovy.svg?raw'
import './app-backdrop.css'

/** Quiet, noninteractive illustration behind the signed-in application frame. */
export function AppBackdrop() {
  return <div className="app-backdrop" aria-hidden="true">
    {/* Static SVG from Open Doodles; its two fills inherit the application theme. */}
    <div className="app-backdrop-doodle" dangerouslySetInnerHTML={{ __html: groovyIllustration }} />
  </div>
}
