/**
 * Aura Partners — Hero 3D Island (R3F + Drei + postprocessing)
 *
 * Storyboard 5 beats (GSAP ScrollTrigger pin):
 *   0-20%: aura/niebla, wordmark AURA centrado apenas visible
 *   20-40%: cámara acerca, AURA extruido aparece dorado real, luz lateral
 *   40-60%: AP iso (pirámide A + círculo P) micromotivo orbital alrededor
 *   60-80%: partículas se separan en 2 caminos: Advisory / Transformation
 *   80-100%: hero estabiliza, proof strip + CTAs aparecen abajo
 *
 * Material: MeshPhysicalMaterial gold PBR (roughness 0.35, metalness 0.85, clearcoat 0.5).
 * Post-fx: Bloom subtle + Vignette + DOF leve. Chromatic OFF (finance premium, no glitch).
 * Particles: 320 instances InstancedMesh sparkles brand color.
 * Reduced-motion: static frame, no animation.
 */

import { Canvas, useFrame, useThree } from '@react-three/fiber';
import { Text, Center, Float, Environment, Instances, Instance } from '@react-three/drei';
import { EffectComposer, Bloom, Vignette, DepthOfField, Noise } from '@react-three/postprocessing';
import { Suspense, useEffect, useMemo, useRef, useState } from 'react';
import * as THREE from 'three';
import { gsap } from 'gsap';
import { ScrollTrigger } from 'gsap/ScrollTrigger';

if (typeof window !== 'undefined') {
  gsap.registerPlugin(ScrollTrigger);
}

// Brand color tokens (hex → THREE.Color)
const COLORS = {
  midnight: '#253458',
  eclipse:  '#22203A',
  violet:   '#605782',
  sand:     '#D9CBB9',
  stone:    '#B1AA9F',
  ink:      '#0F0913'
} as const;

/* ------------------------------------------------------------------ */
/* AURA wordmark extruded (Text3D from drei + MeshPhysicalMaterial gold) */
/* ------------------------------------------------------------------ */

interface AuraWordmarkProps {
  beat: number; // 0..1 driven by ScrollTrigger
}

function AuraWordmark({ beat }: AuraWordmarkProps) {
  const groupRef = useRef<THREE.Group>(null);
  const meshRef = useRef<THREE.Mesh>(null);

  useFrame((_, delta) => {
    if (!groupRef.current) return;
    // Slow drift + beat-driven rotation
    const t = performance.now() * 0.0001;
    const targetRotY = Math.sin(t) * 0.05 + beat * 0.4;
    const targetRotX = -0.06 + beat * 0.05;
    groupRef.current.rotation.y += (targetRotY - groupRef.current.rotation.y) * 0.03;
    groupRef.current.rotation.x += (targetRotX - groupRef.current.rotation.x) * 0.03;

    // Scale entry (beat 0.0 → 0.2 = grow from 0.85 to 1.0)
    const targetScale = 0.85 + Math.min(beat * 4, 1) * 0.15;
    groupRef.current.scale.setScalar(targetScale);
  });

  return (
    <group ref={groupRef}>
      <Center>
        <Text
          ref={meshRef as any}
          font="/fonts/NICKO-ExtraBold.otf"
          fontSize={1.7}
          letterSpacing={0.02}
          anchorX="center"
          anchorY="middle"
          outlineWidth={0.012}
          outlineColor={COLORS.eclipse}
          outlineOpacity={0.4}
        >
          AURA
          <meshPhysicalMaterial
            attach="material"
            color={COLORS.sand}
            roughness={0.35}
            metalness={0.85}
            clearcoat={0.5}
            clearcoatRoughness={0.25}
            reflectivity={0.7}
            envMapIntensity={1.6}
          />
        </Text>
      </Center>
    </group>
  );
}

/* ------------------------------------------------------------------ */
/* Sparkle field — 320 instanced 4-pointed sparkles drifting          */
/* ------------------------------------------------------------------ */

const SPARKLE_COUNT = 320;

function SparkleField({ beat }: { beat: number }) {
  // Custom geometry: 4-pointed star plane (matches ILUSTRACIONES-02 shape)
  const geometry = useMemo(() => {
    const shape = new THREE.Shape();
    const r1 = 0.08;  // outer radius
    const r2 = 0.018; // inner waist
    shape.moveTo(0, r1);
    shape.bezierCurveTo(r2, r2, r2, r2, r1, 0);
    shape.bezierCurveTo(r2, -r2, r2, -r2, 0, -r1);
    shape.bezierCurveTo(-r2, -r2, -r2, -r2, -r1, 0);
    shape.bezierCurveTo(-r2, r2, -r2, r2, 0, r1);
    return new THREE.ShapeGeometry(shape, 8);
  }, []);

  // Distribute sparkles in spherical shell, biased to vertical strip + corners
  const instances = useMemo(() => {
    const arr: { pos: THREE.Vector3; rot: number; scale: number; speed: number; phase: number; lane: number }[] = [];
    for (let i = 0; i < SPARKLE_COUNT; i++) {
      const radius = 4 + Math.random() * 5;
      const theta = Math.random() * Math.PI * 2;
      const phi = (Math.random() - 0.5) * Math.PI * 0.8;
      const x = Math.cos(theta) * Math.cos(phi) * radius;
      const y = Math.sin(phi) * radius * 0.9;
      const z = Math.sin(theta) * Math.cos(phi) * radius * 0.4 - 1;

      arr.push({
        pos: new THREE.Vector3(x, y, z),
        rot: Math.random() * Math.PI * 2,
        scale: 0.5 + Math.random() * 1.6,
        speed: 0.3 + Math.random() * 0.7,
        phase: Math.random() * Math.PI * 2,
        lane: Math.random() < 0.5 ? -1 : 1 // -1 advisory, +1 transformation
      });
    }
    return arr;
  }, []);

  const groupRef = useRef<THREE.Group>(null);

  useFrame((_, delta) => {
    if (!groupRef.current) return;
    const t = performance.now() * 0.0006;
    groupRef.current.children.forEach((child, i) => {
      const data = instances[i];
      if (!data) return;
      const wobble = Math.sin(t * data.speed + data.phase) * 0.4;
      // Lane separation kicks in at beat > 0.6 (storyboard beat 4: split advisory/transformation)
      const split = Math.max(0, beat - 0.6) * 2.5;
      child.position.x = data.pos.x + wobble * 0.3 + data.lane * split;
      child.position.y = data.pos.y + Math.cos(t * data.speed + data.phase) * 0.25;
      child.position.z = data.pos.z;
      child.rotation.z = data.rot + t * 0.4;
    });
  });

  return (
    <group ref={groupRef}>
      <Instances geometry={geometry} limit={SPARKLE_COUNT} frustumCulled={false}>
        <meshBasicMaterial
          color={COLORS.violet}
          transparent
          opacity={0.7}
          blending={THREE.AdditiveBlending}
          depthWrite={false}
          side={THREE.DoubleSide}
        />
        {instances.map((d, i) => (
          <Instance
            key={i}
            position={d.pos}
            rotation={[0, 0, d.rot]}
            scale={d.scale}
          />
        ))}
      </Instances>
    </group>
  );
}

/* ------------------------------------------------------------------ */
/* Camera rig — beat-driven dolly + orbit                              */
/* ------------------------------------------------------------------ */

function CameraRig({ beat }: { beat: number }) {
  const { camera } = useThree();
  useFrame(() => {
    // Dolly: z goes from 6 (far) to 4 (close) across beats
    const targetZ = 6 - beat * 2;
    const targetY = -0.3 + beat * 0.6;
    camera.position.z += (targetZ - camera.position.z) * 0.05;
    camera.position.y += (targetY - camera.position.y) * 0.05;
    camera.lookAt(0, 0.2, 0);
  });
  return null;
}

/* ------------------------------------------------------------------ */
/* Scene wrapper                                                      */
/* ------------------------------------------------------------------ */

export default function Hero3D() {
  const [beat, setBeat] = useState(0);
  const containerRef = useRef<HTMLDivElement>(null);
  const [reduced, setReduced] = useState(false);

  useEffect(() => {
    const mq = window.matchMedia('(prefers-reduced-motion: reduce)');
    setReduced(mq.matches);
    const handler = (e: MediaQueryListEvent) => setReduced(e.matches);
    mq.addEventListener('change', handler);
    return () => mq.removeEventListener('change', handler);
  }, []);

  // GSAP ScrollTrigger: pin hero, scrub `beat` 0→1 across 1.5x viewport scroll
  useEffect(() => {
    if (!containerRef.current || reduced) return;
    const trigger = ScrollTrigger.create({
      trigger: containerRef.current,
      start: 'top top',
      end: '+=150%',
      pin: true,
      scrub: 0.6,
      onUpdate: (self) => setBeat(self.progress)
    });
    return () => trigger.kill();
  }, [reduced]);

  return (
    <div ref={containerRef} className="hero" data-hero-3d>
      <Canvas
        className="hero__canvas"
        dpr={[1, 1.5]}
        gl={{
          antialias: true,
          alpha: false,
          powerPreference: 'high-performance',
          toneMapping: THREE.ACESFilmicToneMapping,
          toneMappingExposure: 1.05
        }}
        camera={{ position: [0, -0.3, 6], fov: 38 }}
        onCreated={({ gl, scene }) => {
          gl.setClearColor(COLORS.eclipse, 1);
          scene.fog = new THREE.Fog(COLORS.eclipse, 7, 14);
        }}
      >
        <Suspense fallback={null}>
          <CameraRig beat={beat} />

          {/* Lighting — subtle, premium, no glow excesivo */}
          <ambientLight intensity={0.18} color={COLORS.violet} />
          <directionalLight position={[3, 4, 5]} intensity={0.9} color="#ffeacc" castShadow={false} />
          <directionalLight position={[-4, -2, 2]} intensity={0.35} color={COLORS.violet} />
          <pointLight position={[0, 0, 3]} intensity={0.4} color={COLORS.sand} />

          {/* HDRI environment: sutil reflejo gold/violet */}
          <Environment preset="night" environmentIntensity={0.4} background={false} />

          {/* AURA wordmark extruded gold PBR */}
          <Float
            speed={0.6}
            rotationIntensity={0.06}
            floatIntensity={0.18}
            enabled={!reduced}
          >
            <AuraWordmark beat={beat} />
          </Float>

          {/* Sparkle field 320 instances drift */}
          <SparkleField beat={beat} />

          {/* Post-processing pipeline (Codex-approved: Bloom subtle + Vignette + DOF, NO Chromatic) */}
          <EffectComposer multisampling={0} disableNormalPass>
            <Bloom
              intensity={0.42}
              luminanceThreshold={0.55}
              luminanceSmoothing={0.7}
              mipmapBlur
            />
            <DepthOfField
              focusDistance={0.012}
              focalLength={0.05}
              bokehScale={2.4}
              height={480}
            />
            <Noise opacity={0.03} />
            <Vignette eskil={false} offset={0.18} darkness={0.65} />
          </EffectComposer>
        </Suspense>
      </Canvas>

      {/* Hero text overlay — sits above canvas */}
      <div className="hero__content container-wide">
        <span className="eyebrow">Aura Partners</span>
        <h1 className="sr-only">Aura Partners — Asesoramiento patrimonial integral</h1>
        <p
          className="hero__tagline"
          style={{
            fontFamily: 'var(--font-display)',
            fontStyle: 'italic',
            fontWeight: 300,
            fontSize: 'var(--text-lead)',
            color: 'var(--color-stone)',
            marginTop: 'min(60vh, 30rem)',
            opacity: Math.max(0, beat - 0.5) * 2,
            transition: 'opacity 400ms var(--ease-aura)'
          }}
        >
          Asesoramiento patrimonial integral
        </p>
      </div>

      {/* Chevron scroll hint */}
      <a
        href="#outcome"
        aria-label="Continuar"
        style={{
          position: 'absolute',
          bottom: '2.5rem',
          left: '50%',
          transform: 'translateX(-50%)',
          color: 'var(--color-sand)',
          opacity: 1 - Math.min(beat * 2, 1),
          transition: 'opacity 300ms var(--ease-aura)',
          zIndex: 2,
          pointerEvents: beat < 0.05 ? 'auto' : 'none'
        }}
      >
        <svg width="28" height="14" viewBox="0 0 24 12" fill="none">
          <path d="M2 2L12 10L22 2" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
        </svg>
      </a>
    </div>
  );
}
