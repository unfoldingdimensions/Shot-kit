'use client'
import { useEffect, useState } from 'react'

/** Loads a bitmap for Konva. 8 lines beats a dependency. */
export function useImage(src: string | null) {
  const [img, setImg] = useState<HTMLImageElement | null>(null)
  useEffect(() => {
    if (!src) {
      setImg(null)
      return
    }
    const i = new window.Image()
    // blobs/data URLs are same-origin, but this keeps a remote source exportable
    i.crossOrigin = 'anonymous'
    i.onload = () => setImg(i)
    i.src = src
    return () => {
      i.onload = null
    }
  }, [src])
  return img
}
