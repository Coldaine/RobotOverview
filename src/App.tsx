import { Navigate, Route, Routes } from 'react-router-dom';
import { Shell } from './components/Shell';
import { BayView } from './views/BayView';
import { Codex } from './views/Codex';
import { HangarHub } from './views/HangarHub';
import { MissionView, MissionsList } from './views/Missions';
import { Quartermaster } from './views/Quartermaster';
import { TechTree } from './views/TechTree';
import { UnitDetail } from './views/UnitDetail';

export default function App() {
  return (
    <Shell>
      <Routes>
        <Route path="/" element={<HangarHub />} />
        <Route path="/bay/:id" element={<BayView />} />
        <Route path="/unit/:id" element={<UnitDetail />} />

        <Route path="/missions" element={<MissionsList />} />
        <Route path="/mission/:id" element={<MissionView />} />

        <Route path="/quartermaster" element={<Quartermaster />} />
        <Route path="/tech-tree" element={<TechTree />} />
        <Route path="/codex" element={<Codex />} />

        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </Shell>
  );
}
