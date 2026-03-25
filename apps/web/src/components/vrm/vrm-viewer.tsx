import { useEffect, useRef } from 'react';
import { Canvas, useFrame, useLoader, useThree } from '@react-three/fiber';
import { VRMLoaderPlugin, VRMUtils, type VRM } from '@pixiv/three-vrm';
import {
  createVRMAnimationClip,
  VRMAnimationLoaderPlugin,
  VRMLookAtQuaternionProxy,
} from '@pixiv/three-vrm-animation';
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js';
import { AnimationMixer, MathUtils, Object3D, Vector3 } from 'three';
import type { Lipsync } from 'wawa-lipsync';

const DEFAULT_CAMERA = { position: [0.125, 1.25, 2] as const, fov: 30 };
const LOOK_AT = new Vector3(0, 1.33, 0);

const VISEME_MAP: Record<string, string> = {
  viseme_aa: 'aa',
  viseme_E: 'ee',
  viseme_I: 'ih',
  viseme_O: 'oh',
  viseme_U: 'ou',
};
const VISEME_ENTRIES = Object.entries(VISEME_MAP);

const BLINK_CLOSE_SPEED = 15;
const BLINK_OPEN_SPEED = 8;
const BLINK_INTERVAL_MIN = 5;
const BLINK_INTERVAL_RANGE = 5;

const GLANCE_DURATION = 2;
const GLANCE_INTERVAL_MIN = 3.75;
const GLANCE_INTERVAL_RANGE = 3.75;
const GAZE_LERP_SPEED = 5;
const VISEME_LERP_SPEED = 12;

const GLANCE_POSITIONS = [
  new Vector3(0.125, -0.85, 1.5),  // down
  new Vector3(-3.125, 1.25, 1.5),  // left
  new Vector3(3.375, 1.25, 1.5),   // right
];

const expDecay = (speed: number, delta: number) => 1 - Math.exp(-speed * delta);
const randomInterval = (min: number, range: number) => min + Math.random() * range;

function useVRM(url: string) {
  const { camera } = useThree();
  const gltf = useLoader(GLTFLoader, url, (loader) => {
    loader.register((parser) => new VRMLoaderPlugin(parser));
  });

  const vrm = gltf.userData.vrm as VRM | undefined;

  useEffect(() => {
    if (!vrm) return;
    if (vrm.meta?.metaVersion === '0') VRMUtils.rotateVRM0(vrm);
    VRMUtils.removeUnnecessaryVertices(vrm.scene);
    VRMUtils.combineSkeletons(vrm.scene);
    // eslint-disable-next-line react-hooks/immutability
    if (vrm.lookAt) vrm.lookAt.target = camera;
    return () => {
      if (vrm.lookAt) vrm.lookAt.target = undefined;
    };
  }, [vrm, camera]);

  return vrm;
}

function useVRMAnimation(vrm: VRM | undefined, url: string, timeScale = 1) {
  const mixerRef = useRef<AnimationMixer | null>(null);

  const vrma = useLoader(GLTFLoader, url, (loader) => {
    loader.register((parser) => new VRMAnimationLoaderPlugin(parser));
  });

  useEffect(() => {
    if (!vrm?.lookAt) return;
    const vrmAnimation = vrma.userData.vrmAnimations?.[0];
    if (!vrmAnimation) return;

    const proxy = new VRMLookAtQuaternionProxy(vrm.lookAt);
    proxy.name = 'VRMLookAtQuaternionProxy';
    vrm.scene.add(proxy);

    const mixer = new AnimationMixer(vrm.scene);
    const action = mixer.clipAction(createVRMAnimationClip(vrmAnimation, vrm));
    action.timeScale = timeScale;
    action.play();
    mixerRef.current = mixer;

    return () => {
      mixer.stopAllAction();
      vrm.scene.remove(proxy);
    };
  }, [vrm, vrma, timeScale]);

  return mixerRef;
}

function VRMModel({
  url,
  animationUrl,
  timeScale = 1,
  lipSync,
}: {
  url: string;
  animationUrl: string;
  timeScale?: number;
  lipSync: React.RefObject<Lipsync | null>;
}) {
  const vrm = useVRM(url);
  const mixerRef = useVRMAnimation(vrm, animationUrl, timeScale);

  const blinkTimerRef = useRef(7);
  const blinkPhaseRef = useRef<'closing' | 'opening' | null>(null);

  // positive = waiting for next glance, negative = glancing (counts down to 0)
  const glanceTimerRef = useRef(7);
  const glancePosRef = useRef(new Vector3());
  const gazeObjRef = useRef(new Object3D());

  useEffect(() => {
    blinkTimerRef.current = randomInterval(BLINK_INTERVAL_MIN, BLINK_INTERVAL_RANGE);
    glanceTimerRef.current = randomInterval(GLANCE_INTERVAL_MIN, GLANCE_INTERVAL_RANGE);
  }, []);

  useEffect(() => {
    if (!vrm?.lookAt) return;
    gazeObjRef.current.position.set(...DEFAULT_CAMERA.position);
    // eslint-disable-next-line react-hooks/immutability
    vrm.lookAt.target = gazeObjRef.current;
  }, [vrm]);

  useFrame((state, delta) => {
    mixerRef.current?.update(delta);
    vrm?.update(delta);

    if (!vrm?.lookAt) return;

    // Glancing — timer positive = waiting, negative = glancing
    glanceTimerRef.current -= delta;
    if (glanceTimerRef.current <= 0) {
      if (glanceTimerRef.current > -GLANCE_DURATION) {
        glancePosRef.current.copy(
          GLANCE_POSITIONS[Math.floor(Math.random() * GLANCE_POSITIONS.length)]
        );
      } else {
        glanceTimerRef.current = randomInterval(GLANCE_INTERVAL_MIN, GLANCE_INTERVAL_RANGE);
      }
    }
    const isGlancing = glanceTimerRef.current < 0;
    const gazeTarget = isGlancing ? glancePosRef.current : state.camera.position;
    gazeObjRef.current.position.lerp(gazeTarget, expDecay(GAZE_LERP_SPEED, delta));

    const em = vrm.expressionManager;
    if (!em) return;

    // Blinking
    blinkTimerRef.current -= delta;
    const blinkValue = em.getValue('blink') ?? 0;
    if (blinkTimerRef.current <= 0 && blinkPhaseRef.current === null) {
      blinkPhaseRef.current = 'closing';
    }
    if (blinkPhaseRef.current === 'closing') {
      const next = MathUtils.lerp(blinkValue, 1, expDecay(BLINK_CLOSE_SPEED, delta));
      em.setValue('blink', next);
      if (next > 0.99) {
        em.setValue('blink', 1);
        blinkPhaseRef.current = 'opening';
      }
    } else if (blinkPhaseRef.current === 'opening') {
      const next = MathUtils.lerp(blinkValue, 0, expDecay(BLINK_OPEN_SPEED, delta));
      em.setValue('blink', next);
      if (next < 0.01) {
        em.setValue('blink', 0);
        blinkPhaseRef.current = null;
        blinkTimerRef.current = randomInterval(BLINK_INTERVAL_MIN, BLINK_INTERVAL_RANGE);
      }
    }

    const ls = lipSync.current;
    if (!ls) return;

    ls.processAudio();
    const viseme = ls.viseme;
    const visemeDecay = expDecay(VISEME_LERP_SPEED, delta);
    for (const [key, expr] of VISEME_ENTRIES) {
      const current = em.getValue(expr) ?? 0;
      const target = key === viseme ? 1 : 0;
      em.setValue(expr, MathUtils.lerp(current, target, visemeDecay));
    }
  });

  if (!vrm) return null;
  return <primitive object={vrm.scene} />;
}

export function VRMViewer({
  lipSync,
}: {
  lipSync: React.RefObject<Lipsync | null>;
}) {
  return (
    <div className="fixed inset-0">
      <Canvas
        camera={{ position: DEFAULT_CAMERA.position, fov: DEFAULT_CAMERA.fov }}
        onCreated={({ camera }) => camera.lookAt(LOOK_AT)}
      >
        <ambientLight intensity={0.8} />
        <directionalLight position={[1, 2, 3]} intensity={1} />
        <VRMModel
          url="/char.vrm"
          animationUrl="/idle.vrma"
          timeScale={0.33}
          lipSync={lipSync}
        />
      </Canvas>
    </div>
  );
}
