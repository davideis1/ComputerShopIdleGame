import { Modal, Pressable, ScrollView, Text, View } from 'react-native';
import { RELEASES, ReleaseEntry, VERSION } from '@/release';
import { colors, theme, themed } from '@/theme';
import { Panel } from './ui';

/** The change log as a sheet: the player's unseen releases after an update, or the last eight from Menu → About. */
export function WhatsNewModal({ visible, entries, onClose }: { visible: boolean; entries: ReleaseEntry[]; onClose: () => void }) {
  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onClose}>
      <View style={styles.backdrop}>
        <View style={styles.wrap}>
          <Panel title={"What's new — v" + VERSION} icon="📰">
            <ScrollView style={styles.list} contentContainerStyle={{ gap: 12 }}>
              {entries.map((e) => (
                <View key={e.build} style={{ gap: 3 }}>
                  <Text style={styles.title}>{e.title}</Text>
                  {e.changes.map((c, i) => <Text key={i} style={styles.line}>• {c}</Text>)}
                </View>
              ))}
              {!entries.length && <Text style={styles.line}>Nothing new yet.</Text>}
            </ScrollView>
            <Pressable style={styles.btn} onPress={onClose}><Text style={styles.btnText}>Got it</Text></Pressable>
          </Panel>
        </View>
      </View>
    </Modal>
  );
}

export const recentReleases = (n = 8) => RELEASES.slice(0, n);

const styles = themed(() => ({
  backdrop: { flex: 1, backgroundColor: 'rgba(0,0,0,0.55)', justifyContent: 'center', padding: 18 },
  wrap: { maxHeight: '82%' },
  list: { maxHeight: 420 },
  title: { color: colors.text, fontSize: 15, fontWeight: '800', fontFamily: theme.titleFont },
  line: { color: colors.dim, fontSize: 14, lineHeight: 20 },
  btn: { backgroundColor: colors.accent, ...theme.btn, paddingVertical: 11, alignItems: 'center', marginTop: 6 },
  btnText: { color: '#fff', fontWeight: '700', fontSize: 15 },
}));
