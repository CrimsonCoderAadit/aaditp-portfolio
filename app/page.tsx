import { existsSync } from "node:fs";
import { join } from "node:path";
import SceneLoader from "@/components/scene/SceneLoader";
import { RESUME } from "@/components/content/resume";

export default function Home() {
  const resume = existsSync(join(process.cwd(), "public", RESUME.file)) ? RESUME.href : null;
  return <SceneLoader resume={resume} />;
}
