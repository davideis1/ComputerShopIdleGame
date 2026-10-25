import { useEffect, useState } from 'react';
import { ActivityIndicator, KeyboardAvoidingView, Modal, Platform, Pressable, ScrollView, Text, TextInput, View } from 'react-native';
import { useAuth } from '@/AuthProvider';
import { useGame, SyncStatus } from '@/GameProvider';
import { AuthModal } from '@/components/AuthModal';
import { colors, theme, themed } from '@/theme';
import { Panel } from '@/components/ui';
import { gcAvailable, gcPlayer, onGcPlayer } from '@/gamecenter';

const statusLine = (s: SyncStatus, at: number | null): string => {
  const when = at ? new Date(at).toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' }) : '';
  switch (s) {
    case 'ok': return '☁️ Saved to your account' + (when ? ' at ' + when : '');
    case 'offline': return "⚠️ Can't reach the server. Progress is kept on this phone and will sync when the connection is back.";
    case 'paused': return '⏸️ Cloud sync is paused until you choose which copy to keep.';
    case 'error': return '⚠️ The server had a problem. Progress is kept on this phone; we will try again.';
    default: return '';
  }
};

/** Menu -> Account: sign in / out, sync status, and in-app account deletion (an App Store requirement). */
export function AccountPanel() {
  const auth = useAuth();
  const { sync, syncNow, notify } = useGame();
  const [authOpen, setAuthOpen] = useState<null | 'in' | 'up'>(null);
  const [delOpen, setDelOpen] = useState(false);
  const [mailOpen, setMailOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const [pwOpen, setPwOpen] = useState(false);
  const [gcBusy, setGcBusy] = useState(false);
  const [gcError, setGcError] = useState<string | null>(null);
  const [gc, setGc] = useState(gcPlayer);
  useEffect(() => onGcPlayer(setGc), []);
  const gcReady = gcAvailable && gc.authenticated;
  const gcRun = async (fn: () => Promise<{ ok: boolean; message?: string; created?: boolean }>, done: (r: any) => string) => {
    setGcBusy(true); setGcError(null);
    const r = await fn();
    setGcBusy(false);
    if (!r.ok) { setGcError(r.message || null); return; }
    notify(done(r));
  };

  return (
    <Panel title="Account" icon="👤">
      {!!auth.notice && <Text style={styles.warn}>{auth.notice}</Text>}
      {auth.status !== 'in' || !auth.user ? (
        <>
          <Text style={styles.body}>
            You are playing without an account: your shop is saved on this phone only. Create a free account to keep a copy in the cloud, switch phones, or play on the website.
          </Text>
          {gcReady && (
            <Pressable style={[styles.btn, gcBusy && { opacity: 0.6 }]} disabled={gcBusy}
              onPress={() => gcRun(auth.signInGameCenter, (r) => (r.created ? '🎮 Account created with Game Center. Your shop now syncs to the cloud.' : '🎮 Signed in with Game Center.'))}>
              {gcBusy ? <ActivityIndicator color="#fff" /> : <Text style={styles.btnText}>🎮 Continue with Game Center{gc.name ? ' as ' + gc.name : ''}</Text>}
            </Pressable>
          )}
          {!!gcError && <Text style={styles.warn}>{gcError}</Text>}
          <View style={styles.row}>
            <Pressable style={styles.btn} onPress={() => setAuthOpen('up')}><Text style={styles.btnText}>Create account</Text></Pressable>
            <Pressable style={[styles.btn, styles.quiet]} onPress={() => setAuthOpen('in')}><Text style={styles.btnText}>Sign in</Text></Pressable>
          </View>
        </>
      ) : (
        <>
          <Text style={styles.body}>Signed in as <Text style={styles.strong}>{auth.user.username}</Text></Text>
          <Text style={styles.sub}>{statusLine(sync.status, sync.at)}</Text>
          {auth.user.hasPassword === false ? (
            <>
              <Text style={styles.sub}>This account signs in with Game Center. Set a password to also sign in on the website (username {auth.user.username}).</Text>
              <Pressable style={[styles.btn, styles.quiet]} onPress={() => setPwOpen(true)}><Text style={styles.btnText}>Set a password</Text></Pressable>
            </>
          ) : (
            <>
              <Text style={styles.sub}>
                {auth.user.email ? 'Password reset email: ' + auth.user.email : 'No email on file, so a forgotten password cannot be reset by email.'}
              </Text>
              <Pressable style={[styles.btn, styles.quiet]} onPress={() => setMailOpen(true)}>
                <Text style={styles.btnText}>{auth.user.email ? 'Change email' : 'Add email'}</Text>
              </Pressable>
            </>
          )}
          {auth.user.gameCenter ? (
            <View style={styles.rowCenter}>
              <Text style={[styles.sub, { flex: 1 }]}>🎮 Linked to Game Center: it signs you in to this account on any iPhone.</Text>
              {auth.user.hasPassword !== false && (
                <Pressable hitSlop={8} disabled={gcBusy} onPress={() => gcRun(auth.unlinkGameCenter, () => 'Game Center unlinked.')}><Text style={styles.link}>Unlink</Text></Pressable>
              )}
            </View>
          ) : gcReady ? (
            <Pressable style={[styles.btn, styles.quiet, gcBusy && { opacity: 0.6 }]} disabled={gcBusy}
              onPress={() => gcRun(auth.linkGameCenter, () => '🎮 Linked: Game Center now signs you in to this account.')}>
              {gcBusy ? <ActivityIndicator color="#fff" /> : <Text style={styles.btnText}>🎮 Link Game Center</Text>}
            </Pressable>
          ) : null}
          {!!gcError && <Text style={styles.warn}>{gcError}</Text>}
          <View style={styles.row}>
            <Pressable
              style={[styles.btn, styles.quiet, busy && { opacity: 0.6 }]} disabled={busy}
              onPress={async () => { setBusy(true); await syncNow(); setBusy(false); }}
            >
              {busy ? <ActivityIndicator color="#fff" /> : <Text style={styles.btnText}>Sync now</Text>}
            </Pressable>
            <Pressable style={[styles.btn, styles.quiet]} onPress={() => auth.signOut()}><Text style={styles.btnText}>Sign out</Text></Pressable>
          </View>
          <Pressable style={[styles.btn, styles.danger]} onPress={() => setDelOpen(true)}>
            <Text style={[styles.btnText, { color: colors.danger }]}>Delete account…</Text>
          </Pressable>
        </>
      )}
      <AuthModal visible={authOpen !== null} initialMode={authOpen ?? 'in'} onClose={() => setAuthOpen(null)} />
      <DeleteModal visible={delOpen} onClose={() => setDelOpen(false)} />
      <EmailModal visible={mailOpen} onClose={() => setMailOpen(false)} />
      <PasswordModal visible={pwOpen} onClose={() => setPwOpen(false)} />
    </Panel>
  );
}

function EmailModal({ visible, onClose }: { visible: boolean; onClose: () => void }) {
  const { setEmail, user } = useAuth();
  const { notify } = useGame();
  const [email, setMail] = useState('');
  const [password, setPassword] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const go = async () => {
    if (busy || !password) return;
    setBusy(true); setError(null);
    const r = await setEmail(email, password);
    setBusy(false);
    if (!r.ok) { setError(r.message); return; }
    setPassword('');
    onClose();
    notify(email.trim() ? 'Email saved. You can now reset your password by email.' : 'Email removed.');
  };

  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose}>
      <KeyboardAvoidingView style={styles.backdrop} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
        <ScrollView contentContainerStyle={styles.center} keyboardShouldPersistTaps="handled">
          <View style={styles.sheet}>
            <Text style={styles.title}>{user?.email ? 'Change email' : 'Add an email'}</Text>
            <Text style={styles.body}>Used only to send you a link if you forget your password. Leave it empty to remove it.</Text>
            <TextInput
              style={styles.input} placeholder="you@example.com" placeholderTextColor={colors.dim} value={email} onChangeText={setMail}
              autoCapitalize="none" autoCorrect={false} keyboardType="email-address" textContentType="emailAddress" autoComplete="email"
            />
            <TextInput style={styles.input} placeholder="Your password" placeholderTextColor={colors.dim} value={password} onChangeText={setPassword} secureTextEntry autoCapitalize="none" />
            {!!error && <Text style={styles.error}>{error}</Text>}
            <Pressable style={[styles.btn, (!password || busy) && { opacity: 0.5 }]} disabled={!password || busy} onPress={go}>
              {busy ? <ActivityIndicator color="#fff" /> : <Text style={styles.btnText}>Save</Text>}
            </Pressable>
            <Pressable onPress={onClose} hitSlop={8}><Text style={styles.dim}>Cancel</Text></Pressable>
          </View>
        </ScrollView>
      </KeyboardAvoidingView>
    </Modal>
  );
}

/** First password for a Game Center account (so it can sign in on the website too). */
function PasswordModal({ visible, onClose }: { visible: boolean; onClose: () => void }) {
  const { setPassword: save, user } = useAuth();
  const { notify } = useGame();
  const [pw, setPw] = useState('');
  const [pw2, setPw2] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const ready = pw.length >= 8 && pw === pw2;

  const go = async () => {
    if (!ready || busy) return;
    setBusy(true); setError(null);
    const r = await save(pw);
    setBusy(false);
    if (!r.ok) { setError(r.message); return; }
    setPw(''); setPw2('');
    onClose();
    notify('Password set. Sign in on the website as ' + (user?.username ?? 'your username') + '.');
  };

  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose}>
      <KeyboardAvoidingView style={styles.backdrop} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
        <ScrollView contentContainerStyle={styles.center} keyboardShouldPersistTaps="handled">
          <View style={styles.sheet}>
            <Text style={styles.title}>Set a password</Text>
            <Text style={styles.body}>Your username is <Text style={styles.strong}>{user?.username}</Text>. With a password you can also play on the website and on phones without Game Center.</Text>
            <TextInput style={styles.input} placeholder="New password (8+ characters)" placeholderTextColor={colors.dim} value={pw} onChangeText={setPw} secureTextEntry autoCapitalize="none" textContentType="newPassword" />
            <TextInput style={styles.input} placeholder="Repeat it" placeholderTextColor={colors.dim} value={pw2} onChangeText={setPw2} secureTextEntry autoCapitalize="none" textContentType="newPassword" />
            {!!error && <Text style={styles.error}>{error}</Text>}
            <Pressable style={[styles.btn, !ready && { opacity: 0.4 }]} disabled={!ready || busy} onPress={go}>
              {busy ? <ActivityIndicator color="#fff" /> : <Text style={styles.btnText}>Save password</Text>}
            </Pressable>
            <Pressable onPress={onClose} hitSlop={8}><Text style={styles.dim}>Cancel</Text></Pressable>
          </View>
        </ScrollView>
      </KeyboardAvoidingView>
    </Modal>
  );
}

function DeleteModal({ visible, onClose }: { visible: boolean; onClose: () => void }) {
  const { deleteAccount, user } = useAuth();
  const { notify } = useGame();
  const [password, setPassword] = useState('');
  const [word, setWord] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const viaGc = user?.hasPassword === false; // no password: Game Center confirms it is you
  const ready = (viaGc || password.length > 0) && word.trim() === 'DELETE';

  const go = async () => {
    if (!ready || busy) return;
    setBusy(true); setError(null);
    const r = await deleteAccount(viaGc ? null : password);
    setBusy(false);
    if (!r.ok) { setError(r.message); return; }
    setPassword(''); setWord('');
    onClose();
    notify('Your account was deleted. Your shop is still on this phone.');
  };

  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose}>
      <KeyboardAvoidingView style={styles.backdrop} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
        <ScrollView contentContainerStyle={styles.center} keyboardShouldPersistTaps="handled">
          <View style={styles.sheet}>
            <Text style={styles.title}>Delete your account?</Text>
            <Text style={styles.body}>
              This permanently deletes the account <Text style={styles.strong}>{user?.username}</Text> and the shop saved in the cloud. It cannot be undone. The shop on this phone is not touched and keeps working without an account.
            </Text>
            {viaGc
              ? <Text style={styles.sub}>🎮 Game Center will confirm it's you.</Text>
              : <TextInput style={styles.input} placeholder="Your password" placeholderTextColor={colors.dim} value={password} onChangeText={setPassword} secureTextEntry autoCapitalize="none" />}
            <TextInput style={styles.input} placeholder="Type DELETE to confirm" placeholderTextColor={colors.dim} value={word} onChangeText={setWord} autoCapitalize="characters" autoCorrect={false} />
            {!!error && <Text style={styles.error}>{error}</Text>}
            <Pressable style={[styles.btn, styles.dangerFill, !ready && { opacity: 0.4 }]} disabled={!ready || busy} onPress={go}>
              {busy ? <ActivityIndicator color="#fff" /> : <Text style={styles.btnText}>Delete my account</Text>}
            </Pressable>
            <Pressable onPress={onClose} hitSlop={8}><Text style={styles.dim}>Cancel</Text></Pressable>
          </View>
        </ScrollView>
      </KeyboardAvoidingView>
    </Modal>
  );
}

const styles = themed(() => ({
  panel: { ...theme.box, padding: 14, gap: 10 },
  title: { color: colors.text, fontSize: 16, fontWeight: '700' },
  body: { color: colors.dim, fontSize: 14, lineHeight: 20 },
  strong: { color: colors.text, fontWeight: '700' },
  sub: { color: colors.dim, fontSize: 12, lineHeight: 17 },
  warn: { color: colors.warn, fontSize: 13, lineHeight: 18 },
  row: { flexDirection: 'row', gap: 10 },
  rowCenter: { flexDirection: 'row', gap: 10, alignItems: 'center' },
  link: { color: colors.accent, fontSize: 13, fontWeight: '700' },
  btn: { flex: 1, backgroundColor: colors.accent, ...theme.btn, paddingVertical: 11, alignItems: 'center' },
  quiet: { backgroundColor: colors.quiet, ...theme.quietBtn },
  danger: { backgroundColor: 'transparent', borderWidth: 1, borderColor: colors.danger },
  dangerFill: { backgroundColor: colors.danger },
  btnText: { color: '#fff', fontWeight: '700', fontSize: 14 },
  backdrop: { flex: 1, backgroundColor: '#000a' },
  center: { flexGrow: 1, justifyContent: 'center', padding: 20 },
  sheet: { backgroundColor: colors.card, borderRadius: Math.min(14, theme.radius), padding: 20, gap: 12 },
  input: { backgroundColor: colors.inset, color: colors.text, borderRadius: Math.min(8, theme.radius), paddingHorizontal: 12, paddingVertical: 12, fontSize: 16 },
  error: { color: colors.danger, fontSize: 14 },
  dim: { color: colors.dim, textAlign: 'center', fontSize: 14 },
}));
