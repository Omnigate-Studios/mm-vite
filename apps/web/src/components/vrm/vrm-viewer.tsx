import { useEffect, useRef } from 'react';
import { Canvas, useFrame, useLoader, useThree } from '@react-three/fiber';
import { VRMLoaderPlugin, VRMUtils, type VRM } from '@pixiv/three-vrm';
import {
  createVRMAnimationClip,
  VRMAnimationLoaderPlugin,
  VRMLookAtQuaternionProxy,
} from '@pixiv/three-vrm-animation';
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js';
import {
  AnimationAction,
  AnimationMixer,
  MathUtils,
  Object3D,
  Vector3,
} from 'three';
import type { Lipsync } from 'wawa-lipsync';

const DEFAULT_CAMERA = { position: [0.5, 1.25, 2] as const, fov: 30 };
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
const CROSSFADE_SPEED = 0.5;
const TALK_TIMEOUT = 2.0;

const GLANCE_POSITIONS = [
  new Vector3(0.125, -0.85, 1.5), // down
  new Vector3(-3.125, 1.25, 1.5), // left
  new Vector3(3.375, 1.25, 1.5), // right
];

const expDecay = (speed: number, delta: number) => 1 - Math.exp(-speed * delta);
const randomInterval = (min: number, range: number) =>
  min + Math.random() * range;

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

function useVRMALoader(url: string) {
  return useLoader(GLTFLoader, url, (loader) => {
    loader.register((parser) => new VRMAnimationLoaderPlugin(parser));
  });
}

function useVRMAnimations(
  vrm: VRM | undefined,
  idleUrl: string,
  talkUrl: string,
  idleTimeScale = 0.33,
  talkTimeScale = 1
) {
  const mixerRef = useRef<AnimationMixer | null>(null);
  const idleActionRef = useRef<AnimationAction | null>(null);
  const talkActionRef = useRef<AnimationAction | null>(null);

  const idleGltf = useVRMALoader(idleUrl);
  const talkGltf = useVRMALoader(talkUrl);

  useEffect(() => {
    if (!vrm?.lookAt) return;
    const idleAnim = idleGltf.userData.vrmAnimations?.[0];
    const talkAnim = talkGltf.userData.vrmAnimations?.[0];
    if (!idleAnim || !talkAnim) return;

    const proxy = new VRMLookAtQuaternionProxy(vrm.lookAt);
    proxy.name = 'VRMLookAtQuaternionProxy';
    vrm.scene.add(proxy);

    const mixer = new AnimationMixer(vrm.scene);

    const idleAction = mixer.clipAction(createVRMAnimationClip(idleAnim, vrm));
    idleAction.timeScale = idleTimeScale;
    idleAction.play();

    const talkAction = mixer.clipAction(createVRMAnimationClip(talkAnim, vrm));
    talkAction.timeScale = talkTimeScale;
    talkAction.setEffectiveWeight(0);
    talkAction.play();

    mixerRef.current = mixer;
    idleActionRef.current = idleAction;
    talkActionRef.current = talkAction;

    return () => {
      mixer.stopAllAction();
      vrm.scene.remove(proxy);
      mixerRef.current = null;
      idleActionRef.current = null;
      talkActionRef.current = null;
    };
  }, [vrm, idleGltf, talkGltf, idleTimeScale, talkTimeScale]);

  return { mixerRef, idleActionRef, talkActionRef };
}

function VRMModel({
  url,
  idleUrl,
  talkUrl,
  idleTimeScale = 0.33,
  talkTimeScale = 1,
  lipSync,
}: {
  url: string;
  idleUrl: string;
  talkUrl: string;
  idleTimeScale?: number;
  talkTimeScale?: number;
  lipSync: React.RefObject<Lipsync | null>;
}) {
  const vrm = useVRM(url);
  const { mixerRef, idleActionRef, talkActionRef } = useVRMAnimations(
    vrm,
    idleUrl,
    talkUrl,
    idleTimeScale,
    talkTimeScale
  );

  const blinkTimerRef = useRef(7);
  const blinkPhaseRef = useRef<'closing' | 'opening' | null>(null);

  const glanceTimerRef = useRef(7);
  const isGlancingRef = useRef(false);
  const glancePosRef = useRef(new Vector3());
  const gazeObjRef = useRef(new Object3D());

  const talkWeightRef = useRef(0);
  const talkTimeoutRef = useRef(0);

  useEffect(() => {
    blinkTimerRef.current = randomInterval(
      BLINK_INTERVAL_MIN,
      BLINK_INTERVAL_RANGE
    );
    glanceTimerRef.current = randomInterval(
      GLANCE_INTERVAL_MIN,
      GLANCE_INTERVAL_RANGE
    );
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

    // Process lipsync early to know current speaking state
    const ls = lipSync.current;
    if (ls) {
      ls.processAudio();
      if (ls.viseme && ls.viseme in VISEME_MAP) {
        talkTimeoutRef.current = TALK_TIMEOUT;
      }
    }

    // Crossfade between idle and talk animations based on speaking state
    talkTimeoutRef.current = Math.max(0, talkTimeoutRef.current - delta);
    const talkWeight = MathUtils.lerp(
      talkWeightRef.current,
      talkTimeoutRef.current > 0 ? 1 : 0,
      expDecay(CROSSFADE_SPEED, delta)
    );
    talkWeightRef.current = talkWeight;
    talkActionRef.current?.setEffectiveWeight(talkWeight);
    idleActionRef.current?.setEffectiveWeight(1 - talkWeight);

    if (!vrm?.lookAt) return;

    // Glancing
    glanceTimerRef.current -= delta;
    if (glanceTimerRef.current <= 0 && !isGlancingRef.current) {
      isGlancingRef.current = true;
      glanceTimerRef.current = GLANCE_DURATION;
      glancePosRef.current.copy(
        GLANCE_POSITIONS[Math.floor(Math.random() * GLANCE_POSITIONS.length)]
      );
    } else if (isGlancingRef.current && glanceTimerRef.current <= 0) {
      isGlancingRef.current = false;
      glanceTimerRef.current = randomInterval(
        GLANCE_INTERVAL_MIN,
        GLANCE_INTERVAL_RANGE
      );
    }
    const gazeTarget = isGlancingRef.current
      ? glancePosRef.current
      : state.camera.position;
    gazeObjRef.current.position.lerp(
      gazeTarget,
      expDecay(GAZE_LERP_SPEED, delta)
    );

    const em = vrm.expressionManager;
    if (!em) return;

    // Blinking
    blinkTimerRef.current -= delta;
    const blinkValue = em.getValue('blink') ?? 0;
    if (blinkTimerRef.current <= 0 && blinkPhaseRef.current === null) {
      blinkPhaseRef.current = 'closing';
    }
    if (blinkPhaseRef.current === 'closing') {
      const next = MathUtils.lerp(
        blinkValue,
        1,
        expDecay(BLINK_CLOSE_SPEED, delta)
      );
      em.setValue('blink', next);
      if (next > 0.99) {
        em.setValue('blink', 1);
        blinkPhaseRef.current = 'opening';
      }
    } else if (blinkPhaseRef.current === 'opening') {
      const next = MathUtils.lerp(
        blinkValue,
        0,
        expDecay(BLINK_OPEN_SPEED, delta)
      );
      em.setValue('blink', next);
      if (next < 0.01) {
        em.setValue('blink', 0);
        blinkPhaseRef.current = null;
        blinkTimerRef.current = randomInterval(
          BLINK_INTERVAL_MIN,
          BLINK_INTERVAL_RANGE
        );
      }
    }

    // Viseme expressions (ls already processed above)
    if (!ls) return;
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
          idleUrl="/idle.vrma"
          talkUrl="/talk.vrma"
          talkTimeScale={0.33}
          lipSync={lipSync}
        />
      </Canvas>
    </div>
  );
}
