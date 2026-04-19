'use client'

import { useEffect, useRef } from 'react'

export default function Cursor() {
  const dotRef  = useRef<HTMLDivElement>(null)
  const ringRef = useRef<HTMLDivElement>(null)
  const mx = useRef(0), my = useRef(0)
  const rx = useRef(0), ry = useRef(0)
  const raf = useRef(0)

  useEffect(() => {
    const move = (e: MouseEvent) => {
      mx.current = e.clientX; my.current = e.clientY
      if (dotRef.current) {
        dotRef.current.style.left = `${e.clientX}px`
        dotRef.current.style.top  = `${e.clientY}px`
      }
    }

    const anim = () => {
      rx.current += (mx.current - rx.current) * 0.1
      ry.current += (my.current - ry.current) * 0.1
      if (ringRef.current) {
        ringRef.current.style.left = `${rx.current}px`
        ringRef.current.style.top  = `${ry.current}px`
      }
      raf.current = requestAnimationFrame(anim)
    }

    // Scale sur les éléments interactifs
    const grow   = () => { dotRef.current && (dotRef.current.style.transform = 'translate(-50%,-50%) scale(2.5)') }
    const shrink = () => { dotRef.current && (dotRef.current.style.transform = 'translate(-50%,-50%) scale(1)') }

    document.addEventListener('mousemove', move)
    raf.current = requestAnimationFrame(anim)

    const els = document.querySelectorAll('a,button,[role="button"],input,textarea,select')
    els.forEach(el => { el.addEventListener('mouseenter', grow); el.addEventListener('mouseleave', shrink) })

    return () => {
      document.removeEventListener('mousemove', move)
      cancelAnimationFrame(raf.current)
      els.forEach(el => { el.removeEventListener('mouseenter', grow); el.removeEventListener('mouseleave', shrink) })
    }
  }, [])

  return (
    <>
      <div ref={dotRef} className="cursor" />
      <div ref={ringRef} className="cursor-ring" />
    </>
  )
}
