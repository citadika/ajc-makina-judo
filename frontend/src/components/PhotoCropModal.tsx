import { useEffect, useRef, useState } from 'react'
import type { PointerEvent as ReactPointerEvent } from 'react'
import './PhotoCropModal.css'

const VIEWPORT = 280
const OUTPUT = 480

interface PhotoCropModalProps {
  imageSrc: string
  title?: string
  onCancel: () => void
  onConfirm: (file: File) => void
}

/**
 * Modale de recadrage de photo (zoom + déplacement) - auto-suffisante
 * (canvas natif, aucune librairie tierce) pour ne pas alourdir
 * l'installation (npm install) côté utilisateur.
 *
 * Principe : l'image est affichée dans une fenêtre carrée fixe
 * (VIEWPORT). Le zoom et le glisser-déposer déplacent l'image à
 * l'intérieur de cette fenêtre, toujours "clampée" pour qu'elle la
 * recouvre entièrement (jamais de bord vide visible). A la
 * confirmation, exactement ce qui est visible dans la fenêtre est
 * redessiné sur un canvas de sortie (OUTPUT), qui devient la
 * nouvelle photo envoyée au serveur.
 */
export function PhotoCropModal({ imageSrc, title, onCancel, onConfirm }: PhotoCropModalProps) {
  const imgElRef = useRef<HTMLImageElement | null>(null)
  const [naturalSize, setNaturalSize] = useState<{ w: number; h: number } | null>(null)
  const [loadError, setLoadError] = useState(false)
  const [zoom, setZoom] = useState(1)
  const [pos, setPos] = useState({ x: 0, y: 0 })

  const dragRef = useRef({ startX: 0, startY: 0, origX: 0, origY: 0, dragging: false })

  useEffect(() => {
    setNaturalSize(null)
    setLoadError(false)
    setZoom(1)
    setPos({ x: 0, y: 0 })

    const img = new Image()
    img.onload = () => setNaturalSize({ w: img.naturalWidth, h: img.naturalHeight })
    img.onerror = () => setLoadError(true)
    img.src = imageSrc
  }, [imageSrc])

  if (loadError) {
    return (
      <div className="modal-overlay" onClick={onCancel}>
        <div className="modal crop-modal" onClick={(e) => e.stopPropagation()}>
          <div className="banner error">Impossible de charger cette image.</div>
          <div className="modal-footer">
            <button type="button" className="btn-secondary" onClick={onCancel}>
              Fermer
            </button>
          </div>
        </div>
      </div>
    )
  }

  if (!naturalSize) {
    return (
      <div className="modal-overlay" onClick={onCancel}>
        <div className="modal crop-modal" onClick={(e) => e.stopPropagation()}>
          <p className="text-faint">Chargement de l'image...</p>
        </div>
      </div>
    )
  }

  const baseScale = Math.max(VIEWPORT / naturalSize.w, VIEWPORT / naturalSize.h)
  const scale = baseScale * zoom
  const dispW = naturalSize.w * scale
  const dispH = naturalSize.h * scale

  const minX = VIEWPORT - dispW
  const minY = VIEWPORT - dispH
  const clampedX = Math.min(0, Math.max(minX, pos.x))
  const clampedY = Math.min(0, Math.max(minY, pos.y))

  function onPointerDown(e: ReactPointerEvent<HTMLDivElement>) {
    dragRef.current = { startX: e.clientX, startY: e.clientY, origX: clampedX, origY: clampedY, dragging: true }
    e.currentTarget.setPointerCapture(e.pointerId)
  }

  function onPointerMove(e: ReactPointerEvent<HTMLDivElement>) {
    if (!dragRef.current.dragging) return
    const dx = e.clientX - dragRef.current.startX
    const dy = e.clientY - dragRef.current.startY
    setPos({ x: dragRef.current.origX + dx, y: dragRef.current.origY + dy })
  }

  function onPointerUp() {
    dragRef.current.dragging = false
  }

  function onZoomChange(nextZoom: number) {
    // Zoome en gardant le point actuellement au centre de la fenêtre
    // fixe, plutôt que de recentrer sur le coin de l'image.
    const oldScale = baseScale * zoom
    const newScale = baseScale * nextZoom
    const focalX = (VIEWPORT / 2 - clampedX) / oldScale
    const focalY = (VIEWPORT / 2 - clampedY) / oldScale
    setZoom(nextZoom)
    setPos({ x: VIEWPORT / 2 - focalX * newScale, y: VIEWPORT / 2 - focalY * newScale })
  }

  function handleConfirm() {
    const sourceImg = imgElRef.current
    if (!sourceImg) return

    if (!naturalSize) return

    const canvas = document.createElement('canvas')
    canvas.width = OUTPUT
    canvas.height = OUTPUT
    const ctx = canvas.getContext('2d')
    if (!ctx) return

    const outputScale = OUTPUT / VIEWPORT
    ctx.imageSmoothingQuality = 'high'
    ctx.drawImage(
      sourceImg,
      0,
      0,
      naturalSize.w,
      naturalSize.h,
      clampedX * outputScale,
      clampedY * outputScale,
      dispW * outputScale,
      dispH * outputScale
    )

    canvas.toBlob(
      (blob) => {
        if (!blob) return
        onConfirm(new File([blob], 'photo-recadree.jpg', { type: 'image/jpeg' }))
      },
      'image/jpeg',
      0.92
    )
  }

  return (
    <div className="modal-overlay" onClick={onCancel}>
      <div className="modal crop-modal" onClick={(e) => e.stopPropagation()}>
        <div className="modal-header">
          <div>
            <h2>{title || 'Ajuster la photo'}</h2>
            <p>Déplacez l'image et réglez le zoom pour bien la cadrer.</p>
          </div>
          <button type="button" className="modal-close" onClick={onCancel}>
            ×
          </button>
        </div>

        <div className="modal-body crop-body">
          <div
            className="crop-viewport"
            onPointerDown={onPointerDown}
            onPointerMove={onPointerMove}
            onPointerUp={onPointerUp}
            onPointerLeave={onPointerUp}
          >
            <img
              ref={imgElRef}
              src={imageSrc}
              alt="Aperçu à recadrer"
              draggable={false}
              className="crop-image"
              style={{ left: clampedX, top: clampedY, width: dispW, height: dispH }}
            />
            <div className="crop-frame" />
          </div>

          <div className="crop-zoom-row">
            <span className="crop-zoom-icon" aria-hidden="true">
              −
            </span>
            <input
              type="range"
              min={1}
              max={3}
              step={0.01}
              value={zoom}
              onChange={(e) => onZoomChange(Number(e.target.value))}
              aria-label="Zoom"
            />
            <span className="crop-zoom-icon" aria-hidden="true">
              +
            </span>
          </div>
          <small className="hint">Glissez la photo pour la repositionner, utilisez le curseur pour zoomer.</small>
        </div>

        <div className="modal-footer">
          <button type="button" className="btn-secondary" onClick={onCancel}>
            Annuler
          </button>
          <button type="button" className="btn-gold" onClick={handleConfirm}>
            Valider le cadrage
          </button>
        </div>
      </div>
    </div>
  )
}
