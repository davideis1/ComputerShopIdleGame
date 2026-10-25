import { useEffect, useState } from 'react';
import { useGame } from '@/GameProvider';
import { BUILD, ReleaseEntry, unseen } from '@/release';
import { loadSeenBuild, saveSeenBuild } from '@/storage';
import { WhatsNewModal } from './WhatsNewModal';

/** After an update, shows what changed once the welcome-back sheet is out of the way (like the website's popup). */
export function WhatsNewGate() {
  const { game, away, catchProgress } = useGame();
  const [entries, setEntries] = useState<ReleaseEntry[]>([]);
  const [checked, setChecked] = useState(false);
  const existing = game.stats.play > 120; // not a brand-new shop

  useEffect(() => {
    if (checked || away || catchProgress != null) return;
    setChecked(true);
    loadSeenBuild().then((seen) => {
      const list = unseen(seen, existing);
      if (list.length) setEntries(list);
      else saveSeenBuild(BUILD);
    });
  }, [checked, away, catchProgress, existing]);

  return (
    <WhatsNewModal
      visible={entries.length > 0}
      entries={entries}
      onClose={() => { setEntries([]); saveSeenBuild(BUILD); }}
    />
  );
}
