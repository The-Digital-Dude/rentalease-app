import React, { useState } from 'react';
import { Alert, KeyboardAvoidingView, Platform, StyleSheet, View } from 'react-native';
import { useRouter, useLocalSearchParams } from 'expo-router';
import { InputField, PasswordInputField, PrimaryButton, ScreenContainer, Subtitle, Title, LinkText, ThemeToggle } from '@components/UI';
import { technicianLogin } from '@services/auth';
import { saveToken } from '@services/secureStore';
import { registerAndSyncPushToken } from '@services/pushNotifications';

export default function LoginPage() {
  const router = useRouter();
  const params = useLocalSearchParams<{ email?: string }>();

  const [email, setEmail] = useState(params.email || '');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [errors, setErrors] = useState<{ email?: string; password?: string }>({});

  function validate() {
    const next: typeof errors = {};
    if (!email) next.email = 'Email is required';
    if (!password) next.password = 'Password is required';
    setErrors(next);
    return Object.keys(next).length === 0;
  }

  async function onSubmit() {
    if (!validate()) return;
    try {
      setLoading(true);
      const trimmedEmail = email.trim();
      console.log('[LoginPage] Attempting login with:', { email: trimmedEmail, passwordLength: password.length });
      const data = await technicianLogin(trimmedEmail, password);
      if (data?.token) await saveToken(data.token);
      if (data?.token) {
        void registerAndSyncPushToken("post-login").catch((error) => {
          console.log("[Push] Post-login registration failed:", error?.message || error);
        });
      }
      router.replace('/(app)');
    } catch (e: any) {
      Alert.alert('Login failed', e?.message || 'Invalid email or password');
    } finally {
      setLoading(false);
    }
  }

  return (
    <ScreenContainer>
      <View style={styles.container}>
        <ThemeToggle />
        <KeyboardAvoidingView behavior={Platform.select({ ios: 'padding', android: undefined })} style={styles.form}>
          <View style={{ width: '100%', maxWidth: 480, alignItems: 'center' }}>
            <Title>Technician Login</Title>
            <Subtitle>Sign in to continue</Subtitle>
            <InputField
              keyboardType="email-address"
              autoCapitalize="none"
              autoCorrect={false}
              placeholder="Email address"
              value={email}
              onChangeText={setEmail}
              error={errors.email}
            />
            <PasswordInputField
              placeholder="Password"
              value={password}
              onChangeText={setPassword}
              error={errors.password}
            />
            <PrimaryButton title={loading ? 'Signing in...' : 'Sign In'} onPress={onSubmit} loading={loading} />
            <LinkText onPress={() => router.push('/(auth)/forgot-password')}>Forgot password?</LinkText>
          </View>
        </KeyboardAvoidingView>
      </View>
    </ScreenContainer>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    width: '100%',
  },
  form: {
    flex: 1,
    width: '100%',
    paddingHorizontal: 16,
    alignItems: 'center',
    justifyContent: 'center',
  },
});
