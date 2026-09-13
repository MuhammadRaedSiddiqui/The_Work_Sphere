import { useEffect, useState } from "react";
import WorkSection from "./WorkSection";
import { SceneLifecycleManager } from "../scene/SceneLifecycleManager";

/** Standalone route shell: deliberately does not mount Hero, About, or ScrollTrigger. */
export default function WorkRouteApp() {
  const [lifecycle, setLifecycle] = useState<SceneLifecycleManager | null>(null);

  useEffect(() => {
    const manager = new SceneLifecycleManager();
    setLifecycle(manager);
    return () => manager.dispose();
  }, []);

  if (!lifecycle) return null;
  return <WorkSection lifecycle={lifecycle} urlMode />;
}
