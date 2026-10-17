import { useState } from 'react';
import { ActivityIndicator, KeyboardAvoidingView, Linking, Modal, Platform, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import { useAuth } from '@/AuthProvider';
import { PRIVACY_URL } from '@/config';
import { colors } from '@/theme';

/** Sign in / create account sheet. Accounts are optional: the game works fully without one. */
export function AuthModal({ visible, initialMode, onClose }: { visible: boolean; initialMode: 'in' | 'up'; onClose: () => void }) {
  const { signIn, signUp } = useAuth();
  const [mode, setMode] = useState<'in' | 'up'>(initialMode);
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [password2, setPassword2] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const up = mode === 'up';
  const submit = async () => {
    if (busy) return;
    if (up && password !== password2) { setError('The two passwords do not match.'); return; }
    setBusy(true); setError(null);
    const r = await (up ? signUp : signIn)(username, password);
    setBusy(false);
    if (!r.ok) { setError(r.message); return; }
    setPassword(''); setPassword2('');
    onClose();
  };
  const switchMode = () => { setMode(up ? 'in' : 'up'); setError(null); };

  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose} onShow={() => setMode(initialMode)}>
      <KeyboardAvoidingView style={styles.backdrop} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
        <ScrollView contentContainerStyle={styles.center} keyboardShouldPersistTaps="handled">
          <View style={styles.sheet}>
            <Text style={styles.title}>{up ? 'Create an account' : 'Sign in'}</Text>
            <Text style={styles.body}>
              {up
                ? 'Your shop is saved to your account, so you can pick it up on another phone or after a reinstall. Your shop on this phone comes with you.'
                : 'Sign in to sync your shop with your account (the same one you use on the website).'}
            </Text>
            <TextInput
              style={styles.input} placeholder="Username" placeholderTextColor={colors.dim}
              value={username} onChangeText={setUsername} autoCapitalize="none" autoCorrect={false} maxLength={20}
              textContentType="username" autoComplete="username"
            />
            <TextInput
              style={styles.input} placeholder={up ? 'Password (8+ characters)' : 'Password'} placeholderTextColor={colors.dim}
              value={password} onChangeText={setPassword} secureTextEntry autoCapitalize="none"
              textContentType={up ? 'newPassword' : 'password'} autoComplete={up ? 'new-password' : 'current-password'}
            />
            {up && (
              <TextInput
                style={styles.input} placeholder="Repeat password" placeholderTextColor={colors.dim}
                value={password2} onChangeText={setPassword2} secureTextEntry autoCapitalize="none" textContentType="newPassword"
              />
            )}
            {up && (
              <Text style={styles.fine}>
                By creating an account you agree that we store your username and shop as described in the{' '}
                <Text style={styles.finelink} onPress={() => Linking.openURL(PRIVACY_URL)}>privacy policy</Text>.
              </Text>
            )}
            {!!error && <Text style={styles.error}>{error}</Text>}
            <Pressable style={[styles.btn, busy && { opacity: 0.6 }]} onPress={submit} disabled={busy}>
              {busy ? <ActivityIndicator color="#fff" /> : <Text style={styles.btnText}>{up ? 'Create account' : 'Sign in'}</Text>}
            </Pressable>
            <Pressable onPress={switchMode} hitSlop={8}><Text style={styles.link}>{up ? 'I already have an account' : 'I need an account'}</Text></Pressable>
            <Pressable onPress={onClose} hitSlop={8}><Text style={styles.dim}>Not now</Text></Pressable>
          </View>
        </ScrollView>
      </KeyboardAvoidingView>
    </Modal>
  );
}

const styles = themed(() => ({
  backdrop: { flex: 1, backgroundColor: '#000a' },
  center: { flexGrow: 1, justifyContent: 'center', padding: 20 },
  sheet: { backgroundColor: colors.card, borderRadius: Math.min(14, theme.radius), padding: 20, gap: 12 },
  title: { color: colors.text, fontSize: 20, fontWeight: '700' },
  body: { color: colors.dim, fontSize: 14, lineHeight: 20 },
  input: { backgroundColor: colors.inset, color: colors.text, borderRadius: Math.min(8, theme.radius), paddingHorizontal: 12, paddingVertical: 12, fontSize: 16 },
  error: { color: colors.danger, fontSize: 14 },
  fine: { color: colors.dim, fontSize: 12, lineHeight: 17 },
  finelink: { color: colors.accent, fontWeight: '600' },
  btn: { backgroundColor: colors.accent, borderRadius: 10, paddingVertical: 14, alignItems: 'center' },
  btnText: { color: '#fff', fontWeight: '700', fontSize: 16 },
  link: { color: colors.accent, textAlign: 'center', fontSize: 14, fontWeight: '600' },
  dim: { color: colors.dim, textAlign: 'center', fontSize: 14 },
}));
