// @ts-nocheck
/* eslint-disable @typescript-eslint/no-explicit-any */
'use client'

import { useRef, useEffect, useState } from 'react'
import { Canvas, useFrame, useThree } from '@react-three/fiber'
import { MeshTransmissionMaterial, Float, Environment, Text } from '@react-three/drei'
import * as THREE from 'three'
import { motion, useScroll, useTransform } from 'framer-motion'

// ─── Monolithe central ───────────────────────────────────────────
function Monolith() {
  const ref = useRef<THREE.Mesh>(null)
  const { mouse } = useThree()

  useFrame((state) => {
    if (!ref.current) return
    const t = state.clock.elapsedTime
    // Respiration : scale pulsant
    ref.current.scale.y = 1 + Math.sin(t * 0.4) * 0.02
    // Réponse à la souris
    ref.current.rotation.y = THREE.MathUtils.lerp(
      ref.current.rotation.y,
      mouse.x * 0.08,
      0.03
    )
    ref.current.rotation.x = THREE.MathUtils.lerp(
      ref.current.rotation.x,
      -mouse.y * 0.04,
      0.03
    )
  })

  return (
    <Float
      speed={0.6}
      rotationIntensity={0.08}
      floatIntensity={0.4}
      floatingRange={[-0.05, 0.05]}
    >
      <mesh ref={ref} castShadow receiveShadow>
        <boxGeometry args={[1.2, 3.2, 0.24]} />
        <MeshTransmissionMaterial
          backside
          samples={16}
          resolution={1024}
          transmission={0.95}
          roughness={0.02}
          thickness={0.5}
          ior={1.52}
          chromaticAberration={0.03}
          anisotropy={0.15}
          distortion={0.08}
          distortionScale={0.2}
          temporalDistortion={0.08}
          color="#E0C4B4"
          attenuationDistance={1.5}
          attenuationColor="#043927"
        />
      </mesh>

      {/* Reflet intérieur */}
      <mesh position={[0, 0, 0.05]}>
        <planeGeometry args={[0.8, 2.4]} />
        <meshBasicMaterial
          color="#E0C4B4"
          transparent
          opacity={0.04}
          side={THREE.DoubleSide}
        />
      </mesh>
    </Float>
  )
}

// ─── Particules ambiantes ────────────────────────────────────────
function Particles({ count = 60 }) {
  const ref = useRef<THREE.Points>(null)
  const positions = useRef(
    new Float32Array(count * 3).map(() => (Math.random() - 0.5) * 12)
  )

  useFrame((state) => {
    if (!ref.current) return
    ref.current.rotation.y = state.clock.elapsedTime * 0.02
    ref.current.rotation.x = Math.sin(state.clock.elapsedTime * 0.015) * 0.05
  })

  return (
    <points ref={ref}>
      <bufferGeometry>
        <bufferAttribute
          attach="attributes-position"
          array={positions.current}
          count={count}
          itemSize={3}
        />
      </bufferGeometry>
      <pointsMaterial
        color="#E0C4B4"
        size={0.018}
        transparent
        opacity={0.35}
        sizeAttenuation
      />
    </points>
  )
}

// ─── Grille de sol ───────────────────────────────────────────────
function Grid() {
  return (
    <gridHelper
      args={[20, 40, '#043927', '#021f15']}
      position={[0, -2.2, 0]}
      rotation={[0, 0, 0]}
    />
  )
}

// ─── Scène 3D ───────────────────────────────────────────────────
function Scene() {
  return (
    <>
      <Environment preset="night" />
      <ambientLight intensity={0.15} />
      <directionalLight
        position={[4, 8, 4]}
        intensity={1.2}
        color="#E0C4B4"
        castShadow
        shadow-mapSize={[2048, 2048]}
      />
      <pointLight position={[-4, 2, -4]} intensity={0.4} color="#043927" />
      <pointLight position={[0, 6, 0]} intensity={0.3} color="#ffffff" />

      <Monolith />
      <Particles />
      <Grid />
    </>
  )
}

// ─── Composant principal ─────────────────────────────────────────
export default function MonolithHero() {
  const containerRef = useRef<HTMLDivElement>(null)
  const { scrollYProgress } = useScroll({ target: containerRef })

  const canvasOpacity = useTransform(scrollYProgress, [0, 0.4], [1, 0])
  const textY         = useTransform(scrollYProgress, [0, 0.3], [0, -60])
  const canvasScale   = useTransform(scrollYProgress, [0, 0.4], [1, 0.88])

  return (
    <div ref={containerRef} style={{ position:'relative', height:'100vh', overflow:'hidden' }}>

      {/* Canvas 3D */}
      <motion.div
        style={{ position:'absolute', inset:0, opacity:canvasOpacity, scale:canvasScale }}
      >
        <Canvas
          shadows
          camera={{ position:[0, 0.5, 5.5], fov:38 }}
          gl={{ antialias:true, toneMapping:THREE.ACESFilmicToneMapping, toneMappingExposure:1.1 }}
          style={{ background:'transparent' }}
        >
          <Scene />
        </Canvas>
      </motion.div>

      {/* Fond dégradé */}
      <div style={{
        position: 'absolute', inset: 0, zIndex: 0,
        background: `
          radial-gradient(ellipse 70% 60% at 50% 10%, rgba(6,81,47,.32) 0%, transparent 70%),
          radial-gradient(ellipse 40% 30% at 80% 85%, rgba(224,196,180,.06) 0%, transparent 60%),
          #020f09
        `,
      }} />

      {/* Texte hero */}
      <motion.div style={{
        position: 'absolute', inset: 0, zIndex: 10,
        display: 'flex', flexDirection: 'column',
        alignItems: 'center', justifyContent: 'center',
        pointerEvents: 'none',
        y: textY,
      }}>
        <p style={{
          fontFamily: "'Cinzel Decorative', serif",
          fontSize: 10, letterSpacing: '.5em',
          color: 'rgba(224,196,180,.4)',
          textTransform: 'uppercase',
          marginBottom: 32,
          animation: 'fade-up .8s ease .3s both',
        }}>
          AETERNA
        </p>

        <h1 style={{
          fontFamily: "'Cormorant Garamond', serif",
          fontSize: 'clamp(52px, 8vw, 108px)',
          fontWeight: 200,
          fontStyle: 'italic',
          lineHeight: .95,
          letterSpacing: '-.01em',
          color: '#F7F2EC',
          textAlign: 'center',
          marginBottom: 28,
          animation: 'fade-up 1.2s ease .5s both',
        }}>
          Vos sanctuaires<br />
          <em style={{ color: '#E0C4B4' }}>éternels</em>
        </h1>

        <p style={{
          fontSize: 14,
          letterSpacing: '.06em',
          color: 'rgba(247,242,236,.42)',
          lineHeight: 1.85,
          maxWidth: 500,
          textAlign: 'center',
          fontFamily: "'Jost', sans-serif",
          fontWeight: 200,
          animation: 'fade-up 1s ease .8s both',
        }}>
          AETERNA ne vend pas de liens.<br />
          Nous bâtissons des sanctuaires pour vos souvenirs les plus précieux.
        </p>
      </motion.div>

      {/* Scroll indicator */}
      <div style={{
        position: 'absolute', bottom: 40, left: '50%',
        transform: 'translateX(-50%)',
        zIndex: 10,
        display: 'flex', flexDirection: 'column',
        alignItems: 'center', gap: 8,
        animation: 'fade-in 1s ease 1.5s both',
      }}>
        <div style={{
          width: 1, height: 48,
          background: 'linear-gradient(to bottom, rgba(224,196,180,.4), transparent)',
          animation: 'scroll-line 2s ease-in-out infinite',
        }} />
      </div>

      <style>{`
        @keyframes fade-up  { from{opacity:0;transform:translateY(24px)} to{opacity:1;transform:translateY(0)} }
        @keyframes fade-in  { from{opacity:0} to{opacity:1} }
        @keyframes scroll-line { 0%,100%{opacity:.4;transform:scaleY(1)} 50%{opacity:.9;transform:scaleY(1.1)} }
      `}</style>
    </div>
  )
}
