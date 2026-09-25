import { useEffect, useMemo } from "react";
import BrickInstances from "./BrickInstances";
import { TABLETOP_Y } from "./districtLayout";
import { createCityInfrastructureKit } from "./cityInfrastructureGeometry";

export default function CityInfrastructure() {
  const kit = useMemo(() => createCityInfrastructureKit(), []);
  useEffect(() => () => {
    kit.brick.dispose();
    kit.stud.dispose();
    Object.values(kit.materials).forEach(material => material.dispose());
  }, [kit]);
  return (
    <group name="City circulation and landscape" position={[0, TABLETOP_Y, 0]}>
      {kit.batches.map(batch => <BrickInstances key={`${batch.finish}-${batch.stud}`} parts={batch.parts} geometry={batch.stud ? kit.stud : kit.brick} material={kit.materials[batch.finish]} />)}
    </group>
  );
}
