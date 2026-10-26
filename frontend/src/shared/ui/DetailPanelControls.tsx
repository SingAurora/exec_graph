import { LocateFixed, PanelRightClose } from 'lucide-react'

type DetailPanelControlsProps = {
  onHide: () => void
  onLocate?: () => void
  locateLabel?: string
}

/** Compact controls for locating the displayed content and temporarily hiding its detail panel. */
export function DetailPanelControls({ onHide, onLocate, locateLabel = '定位内容' }: DetailPanelControlsProps) {
  return (
    <div className="flex shrink-0 items-center gap-1">
      {onLocate && <button type="button" className="icon-button" aria-label={locateLabel} title={locateLabel} onClick={onLocate}><LocateFixed size={16} aria-hidden="true" /></button>}
      <button type="button" className="icon-button" aria-label="隐藏详情" title="隐藏详情" onClick={onHide}><PanelRightClose size={16} aria-hidden="true" /></button>
    </div>
  )
}
