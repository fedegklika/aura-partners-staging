/**
 * Aura Partners — SceneCanvas (full-page persistent 3D experience)
 *
 * Persistente fixed inset:0 a lo largo de TODO el scroll del documento.
 * Lee scroll-progress global (window.scrollY / docHeight) y traduce a beats.
 * Cada beat = scene state (camera position, sparkle density, color emphasis).
 *
 * Beats globales (5):
 *   0.0–0.20 — hero: AURA centered + violet aura
 *   0.20–0.40 — drift: AURA sutil tras y partículas se separan
 *   0.40–0.60 — split: dos paths (advisory navy ←  → transformation violet)
 *   0.60–0.80 — orbit: AP iso flota como joya central + fewer sparkles
 *   0.80–1.00 — aura final: warmth dorado expand, low intensity
 *
 * Reduced-motion: static frame, no animation. Mobile: 30fps + 160 sparkles.
 */

import { Canvas, useFrame, useThree } from '@react-three/fiber';
import { Text, Center, Float, Environment, Instances, Instance } from '@react-three/drei';
import { EffectComposer, Bloom, Vignette, DepthOfField, Noise } from '@react-three/postprocessing';
import { Suspense, useEffect, useMemo, useRef, useState } from 'react';
import * as THREE from 'three';

const COLORS = {
  midnight: '#253458',
  eclipse:  '#22203A',
  violet:   '#605782',
  sand:     '#D9CBB9',
  stone:    '#B1AA9F'
} as const;

/* AURA wordmark — locked center, fade-out only (no return), no wobble rotation */
function AuraWordmark({ beat }: { beat: number }) {
  const ref = useRef<THREE.Group>(null);
  const matRef = useRef<THREE.MeshPhysicalMaterial>(null);
  useFrame(() => {
    if (!ref.current) return;
    // Smooth fade-out: full opacity until beat 0.25, fade 0.25→0.55, hidden after
    const visibility = beat < 0.25
      ? 1
      : beat < 0.55
        ? 1 - (beat - 0.25) / 0.3
        : 0;
    ref.current.scale.setScalar(0.96 + visibility * 0.06);
    if (matRef.current) matRef.current.opacity = visibility;
    // NO rotation/wobble — locked at center
    ref.current.rotation.set(0, 0, 0);
    ref.current.position.set(0, 0, 0);
  });
  return (
    <group ref={ref}>
      <Center>
        <Text
          font="/fonts/NICKO-ExtraBold.otf"
          fontSize={1.7}
          letterSpacing={0.02}
          anchorX="center"
          anchorY="middle"
          outlineWidth={0.014}
          outlineColor={COLORS.eclipse}
          outlineOpacity={0.5}
        >
          AURA
          <meshPhysicalMaterial
            ref={matRef}
            attach="material"
            color={COLORS.sand}
            roughness={0.28}
            metalness={0.92}
            clearcoat={0.7}
            clearcoatRoughness={0.18}
            reflectivity={0.85}
            envMapIntensity={2.4}
            transparent
            opacity={1}
          />
        </Text>
      </Center>
    </group>
  );
}

/* AP isologo (placeholder torus + cone — minimalist mística) */
function AuraIso({ beat }: { beat: number }) {
  const groupRef = useRef<THREE.Group>(null);
  useFrame(() => {
    if (!groupRef.current) return;
    // Visible solo entre beat 0.55 - 0.82
    const v = Math.max(0, Math.min(1, (beat - 0.55) * 5)) * Math.max(0, Math.min(1, (0.82 - beat) * 5));
    groupRef.current.scale.setScalar(v * 1.2);
    groupRef.current.rotation.y += 0.005;
  });
  return (
    <group ref={groupRef} scale={0}>
      {/* Círculo P (torus) */}
      <mesh position={[0, 0.05, 0]}>
        <torusGeometry args={[0.85, 0.04, 16, 64]} />
        <meshPhysicalMaterial color={COLORS.sand} roughness={0.3} metalness={0.9} clearcoat={0.4} envMapIntensity={1.4} />
      </mesh>
      {/* Pirámide A (cone) */}
      <mesh position={[0, 0, 0]}>
        <coneGeometry args={[0.55, 1.1, 4]} />
        <meshPhysicalMaterial color={COLORS.sand} roughness={0.34} metalness={0.85} clearcoat={0.45} envMapIntensity={1.4} flatShading />
      </mesh>
    </group>
  );
}

/* Sparkle field — density + lane-split driven by beat */
function SparkleField({ beat, count }: { beat: number; count: number }) {
  const geometry = useMemo(() => {
    const shape = new THREE.Shape();
    shape.moveTo(0, 0.085);
    shape.bezierCurveTo(0.018, 0.018, 0.018, 0.018, 0.085, 0);
    shape.bezierCurveTo(0.018, -0.018, 0.018, -0.018, 0, -0.085);
    shape.bezierCurveTo(-0.018, -0.018, -0.018, -0.018, -0.085, 0);
    shape.bezierCurveTo(-0.018, 0.018, -0.018, 0.018, 0, 0.085);
    return new THREE.ShapeGeometry(shape, 8);
  }, []);

  const data = useMemo(() => {
    return Array.from({ length: count }, (_, i) => {
      const radius = 4 + Math.random() * 6;
      const theta = Math.random() * Math.PI * 2;
      const phi = (Math.random() - 0.5) * Math.PI * 0.8;
      return {
        basePos: new THREE.Vector3(
          Math.cos(theta) * Math.cos(phi) * radius,
          Math.sin(phi) * radius * 0.9,
          Math.sin(theta) * Math.cos(phi) * radius * 0.4 - 1
        ),
        rot: Math.random() * Math.PI * 2,
        scale: 0.4 + Math.random() * 1.5,
        speed: 0.25 + Math.random() * 0.7,
        phase: Math.random() * Math.PI * 2,
        lane: Math.random() < 0.5 ? -1 : 1
      };
    });
  }, [count]);

  const groupRef = useRef<THREE.Group>(null);

  useFrame(() => {
    if (!groupRef.current) return;
    const t = performance.now() * 0.0006;
    // split intensity: 0 at beat<0.4, peak around beat=0.5, fade by 0.7
    const splitT = Math.max(0, Math.min(1, (beat - 0.35) * 4)) * Math.max(0, Math.min(1, (0.75 - beat) * 4));
    const split = splitT * 1.8;
    // global drift slows after beat 0.6
    const driftMul = beat < 0.6 ? 1 : 1 - (beat - 0.6) * 1.2;

    groupRef.current.children.forEach((child, i) => {
      const d = data[i];
      if (!d) return;
      const wobbleX = Math.sin(t * d.speed + d.phase) * 0.4 * driftMul;
      const wobbleY = Math.cos(t * d.speed + d.phase) * 0.25 * driftMul;
      child.position.set(
        d.basePos.x + wobbleX + d.lane * split,
        d.basePos.y + wobbleY - beat * 0.6,
        d.basePos.z
      );
      child.rotation.z = d.rot + t * 0.4;
      // Scale by visibility (fade out final beat)
      const finalFade = beat > 0.92 ? Math.max(0, (1 - beat) * 12) : 1;
      child.scale.setScalar(d.scale * finalFade);
    });
  });

  // Color by beat: violet → sand mix
  const color = useMemo(() => new THREE.Color(), []);

  useFrame(() => {
    color.set(COLORS.violet).lerp(new THREE.Color(COLORS.sand), Math.max(0, beat - 0.55) * 2);
    if (groupRef.current) {
      const mat = (groupRef.current.children[0] as any)?.parent?.children?.[0]?.material;
      if (mat?.color) mat.color.copy(color);
    }
  });

  return (
    <group ref={groupRef}>
      <Instances geometry={geometry} limit={count} frustumCulled={false}>
        <meshBasicMaterial
          color={COLORS.violet}
          transparent
          opacity={0.7}
          blending={THREE.AdditiveBlending}
          depthWrite={false}
          side={THREE.DoubleSide}
        />
        {data.map((d, i) => (
          <Instance key={i} position={d.basePos} rotation={[0, 0, d.rot]} scale={d.scale} />
        ))}
      </Instances>
    </group>
  );
}

/* Camera rig — subtle dolly only, NO horizontal sway, NO lookAt drift */
function CameraRig({ beat }: { beat: number }) {
  const { camera } = useThree();
  useFrame(() => {
    // Subtle Z dolly: hero close → mid distant → end slight return
    const targetZ = 5.4 + beat * 0.6;
    const targetY = -0.2 + beat * 0.15;
    camera.position.x += (0 - camera.position.x) * 0.06;
    camera.position.y += (targetY - camera.position.y) * 0.05;
    camera.position.z += (targetZ - camera.position.z) * 0.05;
    camera.lookAt(0, 0, 0);
  });
  return null;
}

/* Mouse parallax (subtle) */
function MouseParallax() {
  const { camera } = useThree();
  const target = useRef({ x: 0, y: 0 });
  useEffect(() => {
    const handler = (e: PointerEvent) => {
      target.current.x = (e.clientX / window.innerWidth - 0.5) * 0.3;
      target.current.y = -(e.clientY / window.innerHeight - 0.5) * 0.2;
    };
    if (window.matchMedia('(pointer: fine)').matches) {
      window.addEventListener('pointermove', handler, { passive: true });
      return () => window.removeEventListener('pointermove', handler);
    }
  }, []);
  useFrame(() => {
    camera.position.x += (target.current.x - camera.position.x * 0.5) * 0.02;
    camera.position.y += (target.current.y - camera.position.y * 0.5) * 0.02;
  });
  return null;
}

/* Main SceneCanvas — fixed inset:0, full viewport, listens to global scroll */
export default function SceneCanvas() {
  const [beat, setBeat] = useState(0);
  const [reduced, setReduced] = useState(false);
  const [coarse, setCoarse] = useState(false);

  useEffect(() => {
    const mq = window.matchMedia('(prefers-reduced-motion: reduce)');
    const cm = window.matchMedia('(pointer: coarse)');
    setReduced(mq.matches);
    setCoarse(cm.matches);
    const h1 = (e: MediaQueryListEvent) => setReduced(e.matches);
    const h2 = (e: MediaQueryListEvent) => setCoarse(e.matches);
    mq.addEventListener('change', h1);
    cm.addEventListener('change', h2);
    return () => {
      mq.removeEventListener('change', h1);
      cm.removeEventListener('change', h2);
    };
  }, []);

  useEffect(() => {
    if (reduced) return;
    let raf = 0;
    const update = () => {
      const max = document.documentElement.scrollHeight - window.innerHeight;
      const p = max > 0 ? Math.min(1, Math.max(0, window.scrollY / max)) : 0;
      setBeat(p);
      raf = requestAnimationFrame(update);
    };
    raf = requestAnimationFrame(update);
    return () => cancelAnimationFrame(raf);
  }, [reduced]);

  const sparkleCount = coarse ? 90 : 180;

  return (
    <Canvas
      className="scene-canvas"
      dpr={[1, coarse ? 1.25 : 1.5]}
      gl={{
        antialias: true,
        alpha: false,
        powerPreference: 'high-performance',
        toneMapping: THREE.ACESFilmicToneMapping,
        toneMappingExposure: 1.05
      }}
      camera={{ position: [0, -0.3, 6], fov: 38 }}
      style={{
        position: 'fixed',
        inset: 0,
        width: '100vw',
        height: '100vh',
        zIndex: 0,
        pointerEvents: 'none'
      }}
      onCreated={({ gl, scene }) => {
        gl.setClearColor(COLORS.eclipse, 1);
        scene.fog = new THREE.Fog(COLORS.eclipse, 7, 14);
      }}
    >
      <Suspense fallback={null}>
        <CameraRig beat={beat} />
        {!coarse && <MouseParallax />}

        <ambientLight intensity={0.18} color={COLORS.violet} />
        <directionalLight position={[3, 4, 5]} intensity={0.85} color="#ffeacc" />
        <directionalLight position={[-4, -2, 2]} intensity={0.32} color={COLORS.violet} />
        <pointLight position={[0, 0, 3]} intensity={0.4} color={COLORS.sand} />

        <Environment preset="night" environmentIntensity={0.4} background={false} />

        {/* AURA wordmark NO Float wrapper — keep centered locked */}
        <AuraWordmark beat={beat} />

        <Float speed={0.6} rotationIntensity={0.08} floatIntensity={0.18} enabled={!reduced}>
          <AuraIso beat={beat} />
        </Float>

        <SparkleField beat={beat} count={sparkleCount} />

        <EffectComposer multisampling={0} disableNormalPass>
          <Bloom intensity={0.42} luminanceThreshold={0.55} luminanceSmoothing={0.7} mipmapBlur />
          <DepthOfField focusDistance={0.012} focalLength={0.05} bokehScale={2.4} height={400} />
          <Noise opacity={0.025} />
          <Vignette eskil={false} offset={0.18} darkness={0.6} />
        </EffectComposer>
      </Suspense>
    </Canvas>
  );
}
