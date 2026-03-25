import { useEffect, useRef } from 'react';
import { Canvas, useFrame, useLoader } from '@react-three/fiber';
import { VRMLoaderPlugin, VRMUtils, type VRM } from '@pixiv/three-vrm';
import {
  createVRMAnimationClip,
  VRMAnimationLoaderPlugin,
} from '@pixiv/three-vrm-animation';
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js';
import * as THREE from 'three';
import type { Lipsync } from 'wawa-lipsync';

const DEFAULT_CAMERA = { position: [0.2, 1.2, 2] as const, fov: 30 };
const LOOK_AT = new THREE.Vector3(0, 1.33, 0);

const VISEME_MAP: Record<string, string> = {
  viseme_aa: 'aa',
  viseme_E: 'ee',
  viseme_I: 'ih',
  viseme_O: 'oh',
  viseme_U: 'ou',
};

function useVRM(url: string) {
  const gltf = useLoader(GLTFLoader, url, (loader) => {
    loader.register((parser) => new VRMLoaderPlugin(parser));
  });

  const vrm = gltf.userData.vrm as VRM | undefined;

  useEffect(() => {
    if (!vrm) return;
    if (vrm.meta?.metaVersion === '0') VRMUtils.rotateVRM0(vrm);
    VRMUtils.removeUnnecessaryVertices(vrm.scene);
    VRMUtils.combineSkeletons(vrm.scene);
  }, [vrm]);

  return vrm;
}

function useVRMAnimation(vrm: VRM | undefined, url: string, timeScale = 1) {
  const mixerRef = useRef<THREE.AnimationMixer | null>(null);

  const vrma = useLoader(GLTFLoader, url, (loader) => {
    loader.register((parser) => new VRMAnimationLoaderPlugin(parser));
  });

  useEffect(() => {
    if (!vrm) return;
    const vrmAnimation = vrma.userData.vrmAnimations?.[0];
    if (!vrmAnimation) return;

    const mixer = new THREE.AnimationMixer(vrm.scene);
    const action = mixer.clipAction(createVRMAnimationClip(vrmAnimation, vrm));
    action.timeScale = timeScale;
    action.play();
    mixerRef.current = mixer;

    return () => {
      mixer.stopAllAction();
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
  lipSync: React.MutableRefObject<Lipsync | null>;
}) {
  const vrm = useVRM(url);
  const mixerRef = useVRMAnimation(vrm, animationUrl, timeScale);

  useFrame((_, delta) => {
    mixerRef.current?.update(delta);
    vrm?.update(delta);

    if (!vrm?.expressionManager) return;
    const ls = lipSync.current;
    if (!ls) return;

    ls.processAudio();
    const viseme = ls.viseme;
    const lerpSpeed = 12;

    Object.entries(VISEME_MAP).forEach(([key, expr]) => {
      const current = vrm.expressionManager!.getValue(expr) ?? 0;
      const target = key === viseme ? 1 : 0;
      const next = THREE.MathUtils.lerp(
        current,
        target,
        1 - Math.exp(-lerpSpeed * delta)
      );
      vrm.expressionManager!.setValue(expr, next);
    });
  });

  if (!vrm) return null;
  return <primitive object={vrm.scene} />;
}

export function VRMViewer({
  lipSync,
}: {
  lipSync: React.MutableRefObject<Lipsync | null>;
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
